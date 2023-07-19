
from collections import defaultdict
from flask import Flask, g, request
import random
import sqlite3
import string

app = Flask(__name__)

# -------------------------------- DATABASE ----------------------------------


def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect('db/belay.sqlite3')
        db.row_factory = sqlite3.Row
        setattr(g, '_database', db)
    return db


@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()


def query_db(query, args=(), one=False):
    db = get_db()
    cursor = db.execute(query, args)
    rows = cursor.fetchall()
    db.commit()
    cursor.close()
    if rows:
        if one: 
            return rows[0]
        return rows
    return None


def create_new_user():
    name = "Unnamed User #" + ''.join(random.choices(string.digits, k=6))
    password = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
    api_key = ''.join(random.choices(string.ascii_lowercase + string.digits, k=40))
    query = 'INSERT INTO users (name, password, api_key) VALUES (?, ?, ?) RETURNING id, name, password, api_key'
    user = query_db(query, (name, password, api_key), one=True)
    return user


def authenticate_api_key(request):
    return query_db('SELECT * FROM users WHERE api_key = ?', (request.headers['api_key'],))


def get_user_info(request):
    info = query_db('SELECT * FROM users WHERE api_key = ?', (request.headers['api_key'],), one=True)
    return info['id'], info['name'], info['password'], info['api_key']


def get_names():
    names = query_db('SELECT id, name FROM users')
    return {name['id']: name['name'] for name in names}


def get_reactions():
    happy_info = query_db('SELECT message_id, user_id FROM reactions WHERE reaction = ?', ('happy',))
    happy = defaultdict(set)
    if happy_info:
        for row in happy_info:
            happy[row['message_id']].add(row['user_id'])
    sad_info = query_db('SELECT message_id, user_id FROM reactions WHERE reaction = ?', ('sad',))
    sad = defaultdict(set)
    if sad_info:
        for row in sad_info:
            sad[row['message_id']].add(row['user_id'])
    heart_info = query_db('SELECT message_id, user_id FROM reactions WHERE reaction = ?', ('heart',))
    heart = defaultdict(set)
    if heart_info:
        for row in heart_info:
            heart[row['message_id']].add(row['user_id'])
    return happy, sad, heart


# -------------------------------- ROUTING ----------------------------------


@app.route('/')
@app.route('/channel-<int:channel_id>')
@app.route('/channel-<int:channel_id>/message-<int:message_id>')
@app.route('/profile')
def index(channel_id=None, message_id=None):
    return app.send_static_file('index.html'), 200


@app.errorhandler(404)
def page_not_found(e):
    return app.send_static_file('404.html'), 404


# -------------------------------- API ----------------------------------


@app.route('/api/signup', methods = ['POST'])
def api_signup():
    user = create_new_user()
    return {'username': user['name'], 'password': user['password'], 'api_key': user['api_key']}, 200


@app.route('/api/login', methods = ['GET'])
def api_login():
    username = request.headers['username']
    password = request.headers['password']
    api_key = query_db('SELECT api_key FROM users WHERE name = ? AND password = ?', (username, password), one=True)
    if api_key:
        return {'username': username, 'password': password, 'api_key': api_key['api_key']}, 200
    return {}, 400


@app.route('/api/changeusername', methods = ['POST'])
def api_change_username():
    if not authenticate_api_key(request):
        return {}, 400
    try:
        query_db('UPDATE users SET name = ? WHERE api_key = ?', (request.json['username'], request.headers['api_key']))
        return {}, 200
    except:
        return {}, 400


@app.route('/api/changepassword', methods = ['POST'])
def api_change_password():
    if not authenticate_api_key(request):
        return {}, 400
    try:
        query_db('UPDATE users SET password = ? WHERE api_key = ?', (request.json['password'], request.headers['api_key']))
        return {}, 200
    except:
        return {}, 400


@app.route('/api/getchannels', methods = ['GET'])
def api_get_channels():
    if not authenticate_api_key(request):
        return {}, 400
    channels = query_db('SELECT id, name FROM channels')
    if channels:
        return {0: [(channel['id'], channel['name']) for channel in channels]}, 200
    return {}, 200
  

@app.route('/api/getmessages/<int:channel_id>', methods = ['GET'])
def api_get_messages(channel_id):
    if not authenticate_api_key(request):
        return {}, 400
    if request.headers['type'] == 'messages':
        messages = query_db('SELECT * FROM messages WHERE channel_id = ? AND replies IS NULL', (channel_id,))
    else:
        messages = query_db('SELECT * FROM messages WHERE replies = ?', (request.headers['message_id'],))
    names = get_names()
    response = []
    if messages:
        happy_ids, sad_ids, heart_ids = get_reactions()
        for message in messages:
            happy_names = [names[id] for id in happy_ids[message['id']]]
            sad_names = [names[id] for id in sad_ids[message['id']]]
            heart_names = [names[id] for id in heart_ids[message['id']]]
            response.append((message['id'], names[message['user_id']], message['channel_id'], message['body'], message['replies'], happy_names, sad_names, heart_names))
    return {0: response}, 200


@app.route('/api/createchannel', methods = ['POST'])
def api_create_channel():
    if not authenticate_api_key(request):
        return {}, 400
    name = request.json['name']
    if name != '':
        try:
            query_db('INSERT INTO channels (name) VALUES (?)', (name,))
            return {}, 200
        except:
            return {}, 400
    return {}, 400


@app.route('/api/createmessage', methods = ['POST'])
def api_create_message():
    if not authenticate_api_key(request):
        return {}, 400
    id, _, _, _ = get_user_info(request)
    arguments = (id, request.json['channel_id'], request.json['body'], request.json['replies'])
    if arguments[2] != '':
        query_db('INSERT INTO messages (user_id, channel_id, body, replies) VALUES (?, ?, ?, ?)', arguments)
        return {}, 200
    return {}, 400


@app.route('/api/getreplycounts', methods = ['GET'])
def api_get_reply_counts():
    if not authenticate_api_key(request):
        return {}, 400
    counts = query_db('SELECT replies, COUNT(*) FROM messages GROUP BY replies')
    if counts:
        return {count['replies']: count['COUNT(*)'] for count in counts if count['replies'] is not None}, 200
    return {}, 200


@app.route('/api/getunreadcounts', methods = ['GET'])
def api_get_unread_counts():
    if not authenticate_api_key(request):
        return {}, 400
    id, _, _, _ = get_user_info(request)
    info = query_db('SELECT channel_id, COUNT(*) FROM messages WHERE id > COALESCE((SELECT message_id FROM read WHERE messages.channel_id = read.channel_id AND user_id = ?), 0) GROUP BY channel_id', (id,))
    response = {}
    if info:
        for row in info:
            response[row['channel_id']] = row['COUNT(*)']
    return response, 200


@app.route('/api/createreaction', methods = ['POST'])
def api_create_reaction():
    if not authenticate_api_key(request):
        return {}, 400
    id, _, _, _ = get_user_info(request)
    arguments = (request.json['reaction'], request.json['message_id'], id)
    try:
        query_db('INSERT INTO reactions (reaction, message_id, user_id) VALUES (?, ?, ?)', arguments)
        return {}, 200
    except:
        return {}, 400


@app.route('/api/getparent', methods = ['GET'])
def api_get_parent():
    if not authenticate_api_key(request):
        return {}, 400
    info = query_db('SELECT user_id, body FROM messages WHERE id = ?', (request.headers['message_id'],), one=True)
    author = query_db('SELECT name FROM users WHERE id = ?', (info['user_id'],), one=True)['name']
    return {0: [info['body'], author]}, 200


@app.route('/api/updateread', methods = ['POST'])
def api_update_read():
    if not authenticate_api_key(request):
        return {}, 400
    channel_id = request.json['channel_id']
    user_id, _, _, _ = get_user_info(request)
    recent = query_db('SELECT MAX(id) FROM messages WHERE channel_id = ?', (channel_id,), one=True)['MAX(id)']
    if recent:
        current = query_db('SELECT * FROM read WHERE channel_id = ? AND user_id = ?', (channel_id, user_id))
        if current:
            query_db('UPDATE read SET message_id = ? WHERE user_id = ? AND channel_id = ?', (recent, user_id, channel_id))
        else:
            query_db('INSERT INTO read (user_id, channel_id, message_id) VALUES (?, ?, ?)', (user_id, channel_id, recent))
    return {}, 200


@app.route('/api/getuserinfo', methods = ['GET'])
def api_get_user_info():
    if not authenticate_api_key(request):
        return {}, 400
    id, name, password, api_key = get_user_info(request)
    return {0: id, 1: name, 2: password, 3: api_key}, 200

