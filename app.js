const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const http = require('http');
const https = require('https');
const cookie = require('cookie');

const fs = require('fs');
const spawn = require('child_process').spawn;
const nmap = require('node-nmap');

const ping = require('ping-tcp-js');
const mcstatus = require('minestat');
// Use following until minestat updates the npm package with the fix.
// const mcstatus = require('./data/stores/minestat');

const dataStore = require('./data/data');
const constants = require('./js/const.js');
const tableBuilder = require('./js/tableBuilder.js');

// scuffy solution but works I guess
try {
    require('./config.json');
} catch (e) {
    console.log("Error: Please set up a local config file at <project root>/config.json.");
    console.log("See example Config.json for what to set up.");
    throw e;
}

const config = require('./config.json');

const key = fs.readFileSync(config.security.key, 'utf8');
const cert = fs.readFileSync(config.security.cert, 'utf8');
const cred = { key: key, cert: cert };

const httpPort = config.app.http;
const httpsPort = config.app.https;
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
let ip = undefined;


redir.use(function(req, res, next) {
    res.writeHead(301, { "Location": "https://192.168.2.11:92" });
    // res.writeHead(301, { "Location": "https://conanap.me" });
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
    DEBUG && console.log("Number of PAs at time of request: ", msgs.length);
    return res.json(msgs);
});

// useful shit
app.get('/statuses', function(req, res, next) {
    if (ip == undefined) {
        return res.json("Unknown");
    }
    let port = req.query.port;
    let scan = new nmap.NmapScan(ip, ['-p', port]);

    scan.on('complete', function (data) {
        if(data[0]["openPorts"].length) {
            DEBUG && console.log("scan result");
            DEBUG && console.log(data[0]["openPorts"]);
            return res.json("Online");
        }

        return res.json("Offline");

    });

    scan.on('error', function(err) {
        console.log(err);
        return res.json("Unknown");
    });
    scan.startScan();
});

app.get('/statuses/mc', function(req, res, next) {
    let port = req.query.port;
    return mcstatus.init('localhost', port, function(result) {
        return res.json(mcstatus.online ? "Online" : "Offline");
    });
});

app.get('/statuses/pw', function(req, res, next) {
    let port = req.query.port;
    return res.json("Pending implementation");
});

app.get('/statuses/plex', function(req, res, next) {
    ping.ping(config.servers.plex.host, config.servers.plex.port)
    .then(() => {
        DEBUG && console.log("Plex online");
        return res.json("Online");
    })
    .catch((e) => {
        console.error("Error pinging plex: ", e);
        return res.json("Offline");
    });
});

// get table information

app.get('/statuses/table', function(req, res, next) {
    let headers = config.tableHeaders;
    let generics = config.servers.generic;
    let ret = tableBuilder.build(headers, generics);

    return res.json(ret);
});

app.get('/server-list', function(req, res, next) {
    return res.json(config.servers.generic);
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
        if(err) {
            ip = undefined;
            return err;
        }
        ip = res.ip;
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
            ip = text;
            return text;
        })
        .catch((err) => {
            console.error('Error fetching Public IP:', err);
            ip = undefined;
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
app.post('/pa', function(req, res, next) {
    let time = Date.parse(req.body.expires);
    let currTime = Date.now();
    if(time && time < currTime)
        return res.redirect(constants.failed_page);

    let text = req.body.patext;
    if(!text) return res.redirect(constants.failed_page);

    let cid = id++;
    msgs[cid] = {
        text: text,
        expiry: time,
        id: cid
    };

    console.log("PA " + cid + "posted, expires " + time);

    if(time) {
        setTimeout(function() {
            delete msgs[cid];
        }, time - currTime);
    }

    return res.redirect(constants.success_page);
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

app.post('/service-restart', function(req, res, next) {
    let server_name = req.params.name;
    let service_name = req.params.service;

    if (!dataStore.is_server(service_name, server_name)) {
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