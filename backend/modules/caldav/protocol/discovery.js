function handleWellKnown(req, res) {
    const protocol = req.protocol;
    const host = req.get('host');
    const redirectUrl = `${protocol}://${host}/caldav/`;

    res.redirect(301, redirectUrl);
}

module.exports = {
    handleWellKnown,
};
