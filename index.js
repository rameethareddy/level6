const app = require("./app");
// eslint-disable-next-line no-undef
var port = process.env.PORT || 3000;
app.listen(port, () => {
  // eslint-disable-next-line no-undef
  console.log(`Started express server at port ${process.env.PORT || 3000}`);
});
