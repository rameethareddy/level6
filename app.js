const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const cookieParser = require("cookie-parser");
const csrf = require("tiny-csrf");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const { Todo } = require("./models");
const { User } = require("./models");
const app = express();

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");
// eslint-disable-next-line no-undef
app.use(express.static(path.join(__dirname, "public")));
// eslint-disable-next-line no-undef
app.set("views", path.join(__dirname, "views"));
app.use(cookieParser("Some secret info"));
app.use(csrf("UicgFjabMtvsSJEHUSfK3Dz0NR6K0pIm", ["DELETE", "PUT", "POST"]));
app.use(flash());
app.use(
  session({
    secret: "SuperSecrectInformation",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(function (request, response, next) {
  response.locals.messages = request.flash();
  next();
});

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      User.findOne({ where: { email: email } })
        .then(async (user) => {
          const result = await bcrypt.compare(password, user.password);
          if (result) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Invalid password" });
          }
        })
        .catch(() => {
          return done(null, false, { message: "Invalid email" });
        });
    }
  )
);

passport.serializeUser((user, done) => {
  console.log("Serializing User in session", user.id);
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  console.log("Deserializing User from session", id);
  User.findByPk(id)
    .then((user) => {
      done(null, user);
    })
    .catch((error) => {
      done(error, null);
    });
});

app.get("/", async function (request, response) {
  if (request.user) {
    request.flash("info", "You are already logged in");
    response.redirect("/todos");
  } else {
    response.render("index", {
      title: "Todo Application",
      csrfToken: request.csrfToken(),
    });
  }
});

app.get(
  "/todos",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const loggedInUser = request.user.id;
    const username = request.user.firstName + " " + request.user.lastName;
    const overDue = await Todo.overDue(loggedInUser);
    const dueToday = await Todo.dueToday(loggedInUser);
    const dueLater = await Todo.dueLater(loggedInUser);
    const completedItems = await Todo.completedItems(loggedInUser);
    // console.log(overDue, dueToday, dueLater, completedItems)
    if (request.accepts("html")) {
      response.render("todos", {
        title: "Todo Application",
        overDue: overDue,
        dueToday: dueToday,
        dueLater: dueLater,
        completedItems: completedItems,
        username: username,
        csrfToken: request.csrfToken(),
      });
    } else {
      response.json({
        overDue,
        dueToday,
        dueLater,
        completedItems,
        username,
      });
    }
  }
);

app.post(
  "/todos",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    try {
      await Todo.addTodo({
        title: request.body.title,
        dueDate: request.body.dueDate,
        userId: request.user.id,
      });
      return response.redirect("/todos");
    } catch (error) {
      // console.log(error)
      request.flash(
        "error",
        error.errors.map((error) => error.message)
      );
      response.redirect("/todos");
    }
  }
);

app.put(
  "/todos/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    const todo = await Todo.findOne({
      where: {
        id: request.params.id,
        userId: request.user.id,
      },
    });
    try {
      if (todo) {
        const updatedTodo = await todo.setCompletionStatus({
          completionStatus: request.body.completed,
          userId: request.user.id,
        });
        return response.json(updatedTodo);
      } else {
        return response
          .status(403)
          .json("You are not authorized to update this todo");
      }
    } catch (error) {
      return response.status(422).json(error);
    }
  }
);

app.delete(
  "/todos/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    console.log("We have to delete a Todo with ID: ", request.params.id);
    const todo = await Todo.findByPk(request.params.id);
    const loggedInUser = request.user.id;
    try {
      if (todo) {
        await Todo.remove(todo.id, loggedInUser);
        return response.json({
          success: true,
        });
      } else {
        return response.status(404);
      }
    } catch (error) {
      return response.status(422).json({
        success: false,
      });
    }
  }
);

app.get("/signup", (request, response) => {
  response.render("signup", {
    title: "Sign Up",
    csrfToken: request.csrfToken(),
  });
});

app.post("/users", async (request, response) => {
  const hashedPassword = await bcrypt.hash(request.body.password, saltRounds);
  // console.log(hashedPassword)
  const newUser = {
    firstName: request.body.firstname,
    lastName: request.body.lastname,
    email: request.body.email,
    password: hashedPassword,
  };
  // console.log(newUser)
  try {
    const user = await User.create(newUser);
    request.login(user, (error) => {
      if (error) {
        // console.log(error);
        response.status(422).json(error);
      }
      response.redirect("/todos");
    });
  } catch (error) {
    // console.log(error);
    request.flash(
      "error",
      error.errors.map((error) => error.message)
    );
    response.redirect("/signup");
  }
});

app.get("/login", (request, response) => {
  response.render("signin", {
    title: "Sign In",
    csrfToken: request.csrfToken(),
  });
});

app.post(
  "/session",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (request, response) => {
    response.redirect("/todos");
  }
);

app.get("/signout", (request, response, next) => {
  request.logout((err) => {
    if (err) {
      next(err);
    }
    response.redirect("/");
  });
});

module.exports = app;
