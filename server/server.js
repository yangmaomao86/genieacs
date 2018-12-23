"use strict";

const Koa = require("koa");
const Router = require("koa-router");
const koaStatic = require("koa-static");
const koaCompress = require("koa-compress");
const koaBody = require("koa-body");
const koaJwt = require("koa-jwt");
const jwt = require("jsonwebtoken");

const config = require("./config");
const api = require("./api");
const Authorizer = require("../common/authorizer");

const koa = new Koa();
const router = new Router();

const JWT_SECRET = config.get("server.jwtSecret");
const JWT_COOKIE = "genieacs-ui-jwt";

function getPermissionSets(roles) {
  const allPermissions = config.get("permissions");
  const permissionSets = roles.map(r => Object.values(allPermissions[r] || {}));
  return permissionSets;
}

koa.use(
  koaJwt({
    secret: JWT_SECRET,
    passthrough: true,
    cookie: JWT_COOKIE
  })
);

koa.use(async (ctx, next) => {
  if (ctx.state.user && ctx.state.user.roles)
    ctx.state.authorizer = new Authorizer(
      getPermissionSets(ctx.state.user.roles)
    );
  else ctx.state.authorizer = new Authorizer([]);

  return next();
});

router.post("/login", async ctx => {
  const username = ctx.request.body.username;
  const password = ctx.request.body.password;

  const user = config.get(`auth.simple.users.${username}`);

  if (!user || user.password !== password) {
    ctx.status = 400;
    ctx.body = "Incorrect username or password";
    return;
  }

  let token = jwt.sign({ username: username, roles: user.roles }, JWT_SECRET);
  ctx.cookies.set(JWT_COOKIE, token);
  ctx.body = JSON.stringify(token);
});

router.post("/logout", async ctx => {
  ctx.cookies.set(JWT_COOKIE); // Delete cookie
  ctx.body = "";
});

koa.use(koaBody());
router.use("/api", api.routes(), api.allowedMethods());

router.get("/", async ctx => {
  let permissionSets = [];
  if (ctx.state.user && ctx.state.user.roles)
    permissionSets = getPermissionSets(ctx.state.user.roles);

  ctx.body = `
  <html>
    <head>
      <title>GenieACS</title>
      <link rel="shortcut icon" type="image/png" href="favicon.png" />
      <link rel="stylesheet" href="app.css">
    </head>
    <body>
      <script>
        window.clientConfig = ${JSON.stringify(config.getClientConfig())};
        window.username = ${JSON.stringify(
          ctx.state.user ? ctx.state.user.username : ""
        )};
        window.permissionSets = ${JSON.stringify(permissionSets)};
      </script>
      <script src="app.js"></script>
    </body>
  </html>
  `;
});

koa.use(
  koaCompress({
    flush: require("zlib").Z_SYNC_FLUSH
  })
);
koa.use(router.routes());
koa.use(koaStatic("./public"));

koa.listen(config.get("server.port"), () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${config.get("server.port")}`);
});
