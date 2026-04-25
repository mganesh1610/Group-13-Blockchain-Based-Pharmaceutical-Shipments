const app = require("./app");
const { port } = require("./config");

app.listen(port, () => {
  console.log(`Cold chain IoT log API listening on http://localhost:${port}`);
});
