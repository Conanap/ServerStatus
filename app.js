const express = require('express');
const session = require('express-session');
const fs = require('fs');

const http = require('http');
const https = require('https');
const key = fs.readFileSync('./ssl/private/selfsigned.key', 'utf8');
const cert = fs.readFileSync('./ssl/certs/selfsigned.crt', 'utf8');
const cred = { key: key, cert: cert };

const httpPort = 80;
const httpsPort = 443;

const app = express();
const redir = express();

redir.use(function(req, res, next) {
    res.writeHead(301, { "Location": "https://conanap.ddns.net" });
    res.end();
});

const bodyParser = require('body-parser');
app.use(bodyParser.json());

const exec = require('child_process').exec;

app.use(express.static('static'));

// sessions and security stuff
// app.use(session({ secret: '',
//     resave: false,
//     saveUninitialized: true 
// }));

app.get('/login', function(req, res, next) {
    if(!req.query.username || !req.query.password) {
       return res.writeHead(400, "Did not provide credentials");
        return res.send("Did not provide credentials");
    }
});

// for logging
app.use(function(req, res, next) {
    // console.log("HTTP request");
    next();
});

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