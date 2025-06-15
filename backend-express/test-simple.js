const express = require("express"); const app = express(); app.get("/test", (req, res) => res.json({status: "ok"})); app.listen(8888, () => console.log("Test server on 8888"));
