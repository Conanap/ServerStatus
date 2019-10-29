const express = require('express');
const session = require('express-session');
const fs = require('fs');

const http = require('http');
const https = require('https');
const key = fs.readFileSync('./ssl/private/selfsigned.key', 'utf8');
const cert = fs.readFileSync('./ssl/certs/selfsigned.crt', 'utf8');
const cred = { key: key, cert: cert };
const cookie = require('cookie');

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
    res.writeHead(301, { "Location": "https://conanap.ddns.net" });
    res.end();
});

const bodyParser = require('body-parser');
app.use(bodyParser.json());

const exec = require('child_process').exec;

app.use(express.static('static'));

// sessions and security stuff
app.use(session({ secret: 'clRqtAIhXidnMk4Cz6j7',
    resave: false,
    saveUninitialized: true 
}));

// for logging
app.use(function(req, res, next) {
    // console.log(req.method, req.body);
    next();
});

// login and stuff
app.post('/login', function(req, res, next) {
    if(!req.body.username || !req.body.password) return res.status(400).end("Did not provide credentials");
    let username = req.body.username;
    let password = req.body.password;

    if(username === 'conanap' && password === 'Z7ajGyz87dA0jddIzvoy') {
        req.session.user = 'conanap';
        res.setHeader('Set-Cookie', cookie.serialize({
            path: '/',
            maxAge: 60 * 2
        }));
        return res.json('User conanap signed in');
    }

    return res.status(401).end("Access denied");
});

app.get('/logout', function(req, res, next) {
    req.session.destroy();
    req.username = '';
    res.setHeader('Set-Cookie', cookie.serialize({
        path: '/',
        maxAge: 60 * 2
    }));
});

// server announcement
app.patch('/pa', function(req, res, next) {
    let username = req.body.username;
    let password = req.body.password;
    // if(!req.username) return res.status(401).end("Access denied");
    if(!(username === 'conanap' && password === 'Z7ajGyz87dA0jddIzvoy')) return res.status(401).end("Access denied");

    let time = Date.parse(req.body.time);
    let currTime = Date.now();
    if(!time || time < currTime) return res.status(400).end('Invalid time; use structure "yyyy-mm-ttThh:mm:ssZ", where T and Z are literals.');

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

http.createServer(redir).listen(httpPort, function(err) {
    if(err) console.log(err);
    else console.log('HTTP Server running on ', httpPort);
});
https.createServer(cred, app).listen(httpsPort, function(err) {
    if(err) console.log(err);
    else console.log('HTTPS Server running on ', httpsPort);
});