/**
 * @file Serves files from the file system
 */

var send = require('send');

/**
 * Create a HTTP Handler serving files from the file system
 * @return {Function}
 */
function create(files) {
    var pattern = /^\/(plugins)/;

    return function (req, res, next) {
        var path;

        if (req.method !== 'GET' || !pattern.test(req.url)) return next();

        path = req.url.replace(pattern, '');

        // do not serve files that weren't meant to
        if (!files.check(path)) next();

        send(req, path)
            .on('error', function () { next(); })
            .pipe(res);
    };
}

module.exports.create = create;