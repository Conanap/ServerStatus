const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const http = require('http');
const https = require('https');
const cookie = require('cookie');

const fs = require('fs');
const exec = require('child_process').exec;

const dataStore = require('./data/data');
const constants = require('./const.js');

const key = fs.readFileSync('I:/Documents/homeServer/DDNS/SSLCerts/Exp-2035-oct-18/basic.key', 'utf8');
const cert = fs.readFileSync('I:/Documents/homeServer/DDNS/SSLCerts/Exp-2035-oct-18/basic.crt', 'utf8');
const cred = { key: key, cert: cert };

const httpPort = 80;
const httpsPort = 443;

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
    console.log(req.method, req.originalUrl, req.body);
    return next();
});

app.get('/', function (req, res, next) {
    let loc_session = req.session;
    if (loc_session.userid) {
        console.log("User ", loc_session.userid);
        return next();
    }

    return res.redirect("/login.html");
});

app.get('/login', function (req, res, next) {
    return res.redirect("/login.html");
});

app.post('/user-login', function(req, res, next) {
    let user = {
        ident: req.body.ident,
        password: req.body.password,
    }

    console.log("Trying to login", user);
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
        return res.status(401).redirect('permissiondenied.html');
    });
    
});

// deny access if not logged in
app.use(function(req, res, next) {
    let loc_session = req.session;
    if (loc_session.userid) {
        console.log("User ", loc_session.userid);
        return next();
    }
    return res.redirect('/permissiondenied.html');
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
        if(err) { console.log(err); console.log(stderr); return err; }
        return res.json(stdout);
    });
});

app.get('/statuses/mc', function(req, res, next) {
    exec('tasklist.exe', function(err, stdout, stderr) {
        if(err) { console.log(err); console.log(stderr); return err; }

        return res.json(stdout.indexOf('java.exe') >= 0 ? "Online" : "Offline");
    });
});

app.get('/statuses/plex', function(req, res, next) {
    exec('tasklist.exe', function(err, stdout, stderr) {
        if(err) { console.log(err); console.log(stderr); return err; }
        return res.json(stdout.indexOf('Plex Media Server.exe') >= 0 ? "Online" : "Offline");
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
            console.error('Error fetching Public IP:', error);
            return "Error fetching public IP";
        });

        return res.json(text);
});

app.get('/IP', function(req, res, next) {
    send('GET', 'https://api.ipify.org?format=json', {}, function(err, res) {
        if(err)
            return err;
        return res.json(res.ip);
    });
});


http.createServer(redir).listen(httpPort, function(err) {
    if(err) console.log(err);
    else console.log('HTTP Server running on ', httpPort);
});
https.createServer(cred, app).listen(httpsPort, function(err) {
    if(err) console.log(err);
    else console.log('HTTPS Server running on ', httpsPort);
});

// extra perms required

// gm
app.use(function(req, res, next) {
    let loc_session = req.session;
    if (loc_session.userid && loc_session.permission > constants.permission.gm) {
        console.log("GM ", loc_session.userid);
        return next();
    }
    return res.redirect('permissiondenied.html');
});

app.patch('/permission-set', function(req, res, next) {
    let user = {
        username: req.body.username,
        permission: req.body.permission,
    }

    if (user.permission >= req.session.permission)
        return res.redirect("permissiondenied.html");

    return dataStore.set_permission(user.username, user.permission)
        .then(() => {
            console.log("Permission set:", user);
            return res.redirect('/actionsucceed.html');
        })
        .catch((err) => {
            console.log("User creation error: ", err);
            return res.redirect('/actionfailed.html');
        });
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
    if (loc_session.userid && loc_session.permission > constants.permission.admin) {
        console.log("Admin ", loc_session.userid);
        return next();
    }
    return res.redirect('permissiondenied.html');
});

app.patch('/user-create', function(req, res, next) {
    let user = {
        username: req.body.username,
        email: req.body.email,
        password: req.body.password,
    };

    return dataStore.register(user)
        .then(() => {
            console.log("User created: ", user);
            return res.redirect('/actionsucceed.html');
        })
        .catch((err) => {
            console.log("User creation error: ", err);
            return res.redirect('/actionfailed.html');
        });
});


// supers
app.use(function(req, res, next) {
    let loc_session = req.session;
    if (loc_session.userid && loc_session.permission > constants.permission.super) {
        console.log("Super ", loc_session.userid);
        return next();
    }
    return res.redirect('permissiondenied.html');
});

// god
app.use(function(req, res, next) {
    let loc_session = req.session;
    if (loc_session.userid && loc_session.permission == constants.permission.max) {
        console.log("God? ", loc_session.userid);
        return next();
    }
    return res.redirect('permissiondenied.html');
});