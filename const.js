module.exports = {
    permission: {
        pending: 0,
        min: 1,
        max: 999,
        trusted: 299,
        gm: 499,
        admin: 699,
        super: 799,
        god: 999
    },

    mc_timeout: 180000, // 3min in ms

    denied_page: '/permissiondenied.html',
    failed_page: '/actionfailed.html',
    success_page: '/actionsucceed.html',
    user_reqd_page: '/userrequested.html',
}