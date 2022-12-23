const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const http = require('http');
const https = require('https');
const cookie = require('cookie');

const fs = require('fs');
const exec = require('child_process').exec;
const spawn = require('child_process').spawn;
const mcstatus = require('minestat');
// Use following until minestat updates the npm package with the fix.
// const mcstatus = require('./data/stores/minestat');

const dataStore = require('./data/data');
const constants = require('./const.js');

const key = fs.readFileSync('I:/Documents/homeServer/DDNS/SSLCerts/Exp-2035-oct-18/basic.key', 'utf8');
const cert = fs.readFileSync('I:/Documents/homeServer/DDNS/SSLCerts/Exp-2035-oct-18/basic.crt', 'utf8');
const cred = { key: key, cert: cert };

const httpPort = 80;
const httpsPort = 443;
const DEBUG = false;

const app = express();
const redir = express();

// pa msgs
/* msg = {
    text: String,
    expiry: Int
}
*/
let msgs = {};
let id = 0;


redir.use(function(req, res, next) {
    res.writeHead(301, { "Location": "https://conanap.me" });
    res.end();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static(__dirname + "/static/public"));

// sessions and security stuff
app.use(session({ secret: String(crypto.randomBytes(32)),
    resave: false,
    saveUninitialized: true 
}));

// for logging
app.use(function(req, res, next) {
    DEBUG && console.log(req.method, req.originalUrl, req.body);
    return next();
});

app.get('/', function (req, res, next) {
    let loc_session = req.session;
    if (loc_session.userid) {
        DEBUG && console.log("User ", loc_session.userid);
        return next();
    }

    return res.redirect("/login.html");
});

app.get('/login', function (req, res, next) {
    return res.redirect("/login.html");
});

app.post('/user-create', function(req, res, next) {
    let user = {
        username: req.body.username,
        email: req.body.email,
        password: req.body.password,
    };

    return dataStore.register(user)
        .then(() => {
            DEBUG && console.log("User created: ", user);
            return res.redirect(constants.user_reqd_page);
        })
        .catch((err) => {
            DEBUG && console.log("User creation error: ", err);
            return res.redirect(constants.failed_page);
        });
});

app.post('/user-login', function(req, res, next) {
    let user = {
        ident: req.body.ident,
        password: req.body.password,
    }

    DEBUG && console.log("Trying to login", user.ident);
    return dataStore.login(user)
    .then(function(result) {
        if(result.success) {
            req.session.userid = result.data[0].username;
            req.session.permission = result.data[0].permission;

            res.setHeader('Set-Cookie', cookie.serialize({
                path: '/',
                maxAge: 60 * 2
            }));
            return res.redirect('/');
        }

        // redirect to sign up later
        return res.status(401).redirect(constants.denied_page);
    });
    
});

// deny access if not logged in
app.use(function(req, res, next) {
    let loc_session = req.session;
    if (loc_session.userid) {
        DEBUG && console.log("User ", loc_session.userid);
        return next();
    }
    return res.redirect(constants.denied_page);
});

app.use(express.static('static'));

// login and stuff
app.get('/logout', function(req, res, next) {
    req.session.destroy();
    res.setHeader('Set-Cookie', cookie.serialize({
        path: '/',
        maxAge: 60 * 2
    }));

    return res.redirect('/');
});

app.get('/pa', function(req, res, next) {
    return res.json(msgs);
});

// useful shit
app.get('/statuses', function(req, res, next) {
    exec('tasklist.exe', function(err, stdout, stderr) {
        if(err) { DEBUG && console.log(err); DEBUG && console.log(stderr); return err; }
        return res.json(stdout);
    });
});

app.get('/statuses/mc', function(req, res, next) {
    return mcstatus.init('localhost', 25565, function(result) {
        return res.json(mcstatus.online ? "Online" : "Offline");
    });
});

app.get('/statuses/plex', function(req, res, next) {
    exec('tasklist.exe', function(err, stdout, stderr) {
        if(err) { DEBUG && console.log(err); DEBUG && console.log(stderr); return err; }
        return res.json(stdout.indexOf('Plex Media Server.exe') >= 0 ? "Online" : "Offline");
    });
});

// extra perms required

// Trusted User
app.use(function(req, res, next) {
    let loc_session = req.session;
    if (loc_session.userid && loc_session.permission >= constants.permission.trusted) {
        DEBUG && console.log("Trusted user ", loc_session.userid);
        return next();
    }
    return res.redirect(constants.denied_page);
});

app.get('/IP', function(req, res, next) {
    send('GET', 'https://api.ipify.org?format=json', {}, function(err, res) {
        if(err)
            return err;
        return res.json(res.ip);
    });
});

// get public IP
app.get('/LocIP', async function(req, res, next) {
    // get result from https://v4.ident.me
    let text = await fetch('https://v4.ident.me',
        	{
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
        })
        .then((response) => {
            if (response.ok) {
                return response.text();
            }
        }).then((text) => {
            return text;
        })
        .catch((err) => {
            console.error('Error fetching Public IP:', err);
            return "Error fetching public IP";
        });

        return res.json(text);
});

// gm
app.use(function(req, res, next) {
    let loc_session = req.session;
    if (loc_session.userid && loc_session.permission >= constants.permission.gm) {
        DEBUG && console.log("GM ", loc_session.userid);
        return next();
    }
    return res.redirect(constants.denied_page);
});

// server announcement
app.patch('/pa', function(req, res, next) {
    let time = Date.parse(req.body.time);
    let currTime = Date.now();
    if(!time || time < currTime)
        return res.status(400)
        .end('Invalid time; use structure "yyyy-mm-ttThh:mm:ssZ", where T and Z are literals.');

    let text = req.body.text;
    if(!text) return res.status(400).end('Invalid message');

    let cid = id++;
    msgs[cid] = {
        text: text,
        expiry: time
    };

    setTimeout(function() {
        delete msgs[cid];
    }, time - currTime);
    return res.status(200).end("PA successfully posted");
});

// admins
app.use(function(req, res, next) {
    let loc_session = req.session;
    if (loc_session.userid && loc_session.permission >= constants.permission.admin) {
        DEBUG && console.log("Admin ", loc_session.userid);
        return next();
    }
    return res.redirect(constants.denied_page);
});

app.post('/permission-set', function(req, res, next) {
    let user = {
        username: req.body.ident,
        permission: req.body.permission,
    }

    if (user.permission >= req.session.permission)
        return res.redirect(constants.denied_page);

    return dataStore.set_permission(user.username, user.permission)
        .then(() => {
            DEBUG && console.log("Permission set:", user);
            return res.redirect(constants.success_page);
        })
        .catch((err) => {
            DEBUG && console.log("User creation error: ", err);
            return res.redirect(constants.failed_page);
        });
});

app.get('/user-approve', function(req, res, next) {
    let user = req.query.user;

    return dataStore.set_permission(user, constants.permission.min)
        .then(() => {
            DEBUG && console.log("Account approved:", user);
            return res.redirect(constants.success_page);
        })
        .catch((err) => {
            DEBUG && console.log("User creation error: ", err);
            return res.redirect(constants.failed_page);
        });
});

app.get('/user-deny', function(req, res, next) {
    let user = req.query.user;

    return dataStore.deregister(user)
        .then(() => {
            DEBUG && console.log("Account approved:", user);
            return res.redirect(constants.success_page);
        })
        .catch((err) => {
            DEBUG && console.log("User creation error: ", err);
            return res.redirect(constants.failed_page);
        });
});

app.get('/approval-list', function(req, res, next) {

    return dataStore.get_awiting_approval()
        .then((list) => {
            return res.json(list);
        })
        .catch((err) => {
            return res.redirect(constants.failed_page);
        });
});

app.get('/user-list', function(req, res, next) {

    return dataStore.get_user_list()
        .then((list) => {
            return res.json(list);
        })
        .catch((err) => {
            return res.redirect(constants.failed_page);
        });
});

app.post('/mc-restart', function(req, res, next) {
    let server_name = req.params.name;

    if (!dataStore.is_minecraft_server(server_name)) {
        return res.status(404).send("No such server" + server_name);
    }

    console.log("Restarting " + server_name);
    let server = dataStore.get_minecraft_process(server_name);
    let timestamp = dataStore.get_minecraft_process_timestamp(server_name);
    let should_spawn = Date.now() - timestamp > constants.mc_timeout;

    if(!should_spawn) {
        return res.status(425).send("Must wait 3 minutes from " + timestamp + "before re-trying");
    }

    console.log("Restarting " + server_name);
    if(server) {
        server.kill();
    }

    server = spawn(constants.mcscript[server_name]);
    timestamp = Date.now();

    return res.status(200).send(timestamp);
});

// supers
app.use(function(req, res, next) {
    let loc_session = req.session;
    if (loc_session.userid && loc_session.permission >= constants.permission.super) {
        DEBUG && console.log("Super ", loc_session.userid);
        return next();
    }
    return res.redirect(constants.denied_page);
});

app.patch('/user-delete', function(req, res, next) {
    let user = req.body.ident;

    return dataStore.deregister(user)
    .then((success) => {
        if (success)
            return res.redirect('actionsucceed.html');
        return res.redirect(constants.failed_page);
    });
});

// god
app.use(function(req, res, next) {
    let loc_session = req.session;
    if (loc_session.userid && loc_session.permission == constants.permission.max) {
        DEBUG && console.log("God? ", loc_session.userid);
        return next();
    }
    return res.redirect(constants.denied_page);
});

app.put('/debug', function(req, res, next) {
    DEBUG = req.body.debug;

    console.log("Debug set to ", DEBUG);
    return res.redirect(constants.success_page);
});

http.createServer(redir).listen(httpPort, function(err) {
    if(err) console.log(err);
    else console.log('HTTP Server running on ', httpPort);
});
https.createServer(cred, app).listen(httpsPort, function(err) {
    if(err) console.log(err);
    else console.log('HTTPS Server running on ', httpsPort);
});