const loginAsid = async (email, password) => {
    const loginUrl = `${process.env.API_ASID_URL}/api/v1/login/access-token`;

    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', email);
    params.append('password', password);

    const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
        },
        body: params.toString(),
    });

    if (!response.ok) {
        // Let the caller decide how to handle auth failure
        throw new Error('ASID authentication failed');
    }

    const json = await response.json();
    return json;
};

module.exports = {
    loginAsid,
};
