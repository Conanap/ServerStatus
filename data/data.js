const bcrypt = require('bcrypt')
const knex = require('knex');
const constants = require('../const.js');

const db = knex({
    client: 'better-sqlite3',
    connection: {
        // for some reason it's from project root lol
        // well I guess it's from the executing file, so app.js
        // but __dirnamegoes to this file's loc, so /data
        filename: __dirname + '/stores/localdb.db'
    },
    useNullAsDefault: true
});

const USERDATADB = 'user';

async function register(data) {
    if (!data.username || !data.email || !data.password)
        throw 'Need to provide all of username, email and password.';
 
    return bcrypt.hash(data.password, 16)
    .then((hash) => {
       // store
       data.password = hash;
       data.attempts = 0;
       data.attemptTimestamp = 0;
       data.permission = constants.permission.pending;

        return db(USERDATADB).insert(data);
    })
    .then(() => {
        return {
            status: 200,
            message: "User successfully created."
        }
    })
    .catch((err) => {
        console.error("User creation failed for ", data.username, ":", err);
        throw err;
    });
};

async function deregister(ident) {
    return db(USERDATADB)
        .where({ username: ident })
        .orWhere({ email: ident })
        .delete()
        .then(() => {
            return true;
        })
        .catch((err) => {
            console.log("Error deleting user ", ident, ": ", err);
            throw err;
        });
};

async function get_awiting_approval() {
    return db(USERDATADB)
        .where({ permission: constants.permission.pending })
        .select()
        .catch((err) => {
            console.log("Error deleting user ", ident, ": ", err);
            return false;
        });
};

async function get_user_list() {
    return db(USERDATADB)
        .select('username', 'email', 'permission')
        .catch((err) => {
            console.log("Error deleting user ", ident, ": ", err);
            return false;
        });
};

async function login(user) {

    return db(USERDATADB)
        .where({ email: user.ident })
        .orWhere({ username: user.ident })
        .select('*')
    .then((data) => {

        if (!data.length)
            return false;

        if (data[0].attempts >= 5 &&
            Date.now() - data[0].attemptTimestamp < 30000) {
            return [data, false];
        }

        return {
            data: data,
            success: data[0].permission && bcrypt.compare(user.password, data[0].password),
        };
    })
    .then((result) => {
        let data = result.data;
        let auth_res = result.success;

        // check for pending approval
        if (!data[0].permission)
            return {data: undefined, success: false};

        data[0].attempts = result ? 0 : data[0].attempts + 1;
        data[0].attemptTimestamp = Date.now();
    
        db(USERDATADB)
        .where({ username: data[0].username })
        .update({ attempts: data[0].attempts,
            attemptTimestamp: data[0].attemptTimestamp });

        return {
            data: data,
            success: auth_res
        };
    })
    .catch((err) => {
        if (err) {
            console.error("Cannot compare password:", err);
            return {data: undefined, success: false};
        }
    });
};

async function set_permission(username, permission_level) {
    return db(USERDATADB)
        .where({ username: username })
        .orWhere({ email: username })
        .select('permission')
        .then((perm) => {
            if(perm === constants.permission.max)
                console.log("Cannot change max permission to other permissions.");
                throw "Cannot change max permission to other permissions.";
            
            return db(USERDATADB)
            .where({ username: username })
            .orWhere({ email: username })
            .update({ permission: permission_level })
        })
        .then(() => {
            console.log("Permssion level for ", username, " est to ", permission_level);
            return true;
        })
        .catch((err) => {
            console.log("Cannot set permission level for ", username, " to ", permission_level);
            throw err;
        });

};

module.exports = {
    register: register,
    login: login,
    set_permission: set_permission,
    deregister: deregister,
    get_awiting_approval: get_awiting_approval,
    get_user_list: get_user_list,
};