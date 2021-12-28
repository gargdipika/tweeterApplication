const express = require("express");
app = express();
app.use(express.json());

const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

let db = null;
initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

//API 1 register the user
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  const getUser = `
    SELECT * FROM user
    WHERE username = '${username}';`;

  const userDetail = await db.get(getUser);
  if (userDetail === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const addUser = `
            INSERT INTO user 
            (username, name, password, gender)
            VALUES(
                '${username}',
                '${name}',
                '${hashedPassword}',
                '${gender}'
            );`;
      await db.run(addUser);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    console.log(userDetail);
    response.status(400);
    response.send("User already exists");
  }
});

//API 2 login user
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const getUser = `
    SELECT * FROM user
    WHERE username = '${username}';`;

  const userDetail = await db.get(getUser);

  if (userDetail === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isCorrectPassword = await bcrypt.compare(
      password,
      userDetail.password
    );
    if (isCorrectPassword === true) {
      const payload = {
        username: username,
      };
      const jwtToken = await jwt.sign(payload, "SECRETE");
      response.status(200);
      response.send({ jwtToken: jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//authorization
const checkAuthorized = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    console.log("run2");
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRETE", async (error, payload) => {
      if (error) {
        response.status(401);
        console.log("run1");
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API 3 get user
app.get("/user/tweets/feed", checkAuthorized, async (request, response) => {
  let { username } = request;
  console.log(username);
  const getLoggedUserDetailQuery = `
  SELECT * FROM user
  WHERE username = '${username}';`;
  const loggedUserDetail = await db.get(getLoggedUserDetailQuery);

  const getAllUsersQuery = `
  SELECT user.username, tweet.tweet, tweet.date_time AS dateTime
  FROM tweet NATURAL JOIN user
  WHERE tweet.user_id IN (SELECT following_user_id
    FROM follower 
    WHERE follower_user_id = ${loggedUserDetail.user_id})
  ORDER BY tweet.date_time DESC
  LIMIT 4;
  `;

  const getAllUsers = await db.all(getAllUsersQuery);
  response.send(getAllUsers);
});

//API 4
app.get("/user/following/", checkAuthorized, async (request, response) => {
  let { username } = request;
  console.log(username);
  const getLoggedUserDetailQuery = `
  SELECT * FROM user
  WHERE username = '${username}';`;
  const loggedUserDetail = await db.get(getLoggedUserDetailQuery);

  const getAllUserQuery = `
  SELECT name
  FROM user
  WHERE user_id IN (SELECT following_user_id
    FROM follower 
    WHERE follower_user_id = ${loggedUserDetail.user_id});`;

  const getAllUser = await db.all(getAllUserQuery);
  response.send(getAllUser);
});

//API 5
app.get("/user/followers/", checkAuthorized, async (request, response) => {
  let { username } = request;
  console.log(username);
  const getLoggedUserDetailQuery = `
  SELECT * FROM user
  WHERE username = '${username}';`;
  const loggedUserDetail = await db.get(getLoggedUserDetailQuery);

  const getAllUserQuery = `
  SELECT name
  FROM user
  WHERE user_id IN (SELECT follower_user_id
    FROM follower 
    WHERE following_user_id = ${loggedUserDetail.user_id});`;

  const getAllUser = await db.all(getAllUserQuery);
  response.send(getAllUser);
});

//API 6
app.get("/tweets/:tweetId/", checkAuthorized, async (request, response) => {
  const { tweetId } = request.params;
  let { username } = request;
  console.log(username);
  const getLoggedUserDetailQuery = `
  SELECT * FROM user
  WHERE username = '${username}';`;
  const loggedUserDetail = await db.get(getLoggedUserDetailQuery);

  const getUsersQuery = `
  SELECT tweet.tweet AS tweet, COUNT(distinct like.like_id) AS likes, COUNT(distinct reply.reply) AS replies, tweet.date_time AS dateTime
  FROM tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id 
  INNER JOIN reply ON like.tweet_id = reply.tweet_id
  WHERE tweet.user_id IN (
      SELECT following_user_id
      FROM follower 
      WHERE follower_user_id = ${loggedUserDetail.user_id} 
  ) AND tweet.tweet_id = ${tweetId};`;

  const getUsers = await db.get(getUsersQuery);

  console.log(getUsers.tweet === null);
  if (getUsers.tweet === null) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    response.send(getUsers);
  }
});

//API 7
app.get(
  "/tweets/:tweetId/likes/",
  checkAuthorized,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;
    console.log(username);
    const getLoggedUserDetailQuery = `
  SELECT * FROM user
  WHERE username = '${username}';`;
    const loggedUserDetail = await db.get(getLoggedUserDetailQuery);

    const getUsersQuery = `
  SELECT user.username
  FROM tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id 
  INNER JOIN user ON like.user_id = user.user_id 
  WHERE tweet.user_id IN (
      SELECT following_user_id
      FROM follower 
      WHERE follower_user_id = ${loggedUserDetail.user_id} 
  ) AND tweet.tweet_id = ${tweetId};`;

    const getUsers = await db.all(getUsersQuery);
    const getUsersList = getUsers.map((eachUser) => eachUser.username);
    const userListResponse = { likes: getUsersList };
    console.log(userListResponse.likes.length);
    if (userListResponse.likes.length === 0) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.send(userListResponse);
    }
  }
);

//API 8
app.get(
  "/tweets/:tweetId/replies/",
  checkAuthorized,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;
    console.log(username);
    const getLoggedUserDetailQuery = `
  SELECT * FROM user
  WHERE username = '${username}';`;
    const loggedUserDetail = await db.get(getLoggedUserDetailQuery);

    const getUsersNameAndRepliesQuery = `
  SELECT user.name AS name, reply.reply AS reply
  FROM tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id 
  INNER JOIN user ON reply.user_id = reply.user_id 
  WHERE tweet.user_id IN (
      SELECT following_user_id
      FROM follower 
      WHERE follower_user_id = ${loggedUserDetail.user_id} 
  ) AND tweet.tweet_id = ${tweetId};`;

    const getUsersNameAndReply = await db.all(getUsersNameAndRepliesQuery);

    const getTweetQuery = `
    SELECT *
    from tweet
    where tweet_id = ${tweetId};`;

    const getTweet = await db.get(getTweetQuery);

    const listNameAndReply = { replies: getUsersNameAndReply };
    const listResponse = [getTweet, listNameAndReply];

    if (listNameAndReply.replies.length === 0) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.send(listResponse);
    }
  }
);

//API 9
app.get("/user/tweets/", checkAuthorized, async (request, response) => {
  let { username } = request;
  const getUserId = `SELECT user_id FROM user 
    WHERE username = '${username}';`;

  const userId = await db.get(getUserId);
  console.log(userId.user_id);
  const getAllTweets = `
   SELECT tweet.tweet AS tweet, COUNT(distinct like.like_id) AS likes, COUNT(distinct reply.reply) AS replies, tweet.date_time AS dateTime
  FROM tweet LEFT JOIN like ON tweet.tweet_id = like.tweet_id 
  LEFT JOIN reply ON like.tweet_id = reply.tweet_id
  WHERE tweet.user_id = ${userId.user_id};`;

  const tweetList = await db.all(getAllTweets);
  response.send(tweetList);
});

//API 10
app.post("/user/tweets/", checkAuthorized, async (request, response) => {
  console.log(request.body);
  const { tweet } = request.body;
  console.log(tweet);

  const addUserQuery = `
    INSERT INTO tweet
    (tweet)
    VALUES (
       '${tweet}'
    );`;

  await db.run(addUserQuery);
  response.send("Created a Tweet");
});

//API 11
app.delete("/tweets/:tweetId/", checkAuthorized, async (request, response) => {
  const { username } = request;
  const { tweetId } = request.params;

  const getUserId = `SELECT user_id
    FROM user
    WHERE username = '${username}';`;

  const userId = await db.get(getUserId);

  const getUserIdFromTweet = `SELECT user_id FROM tweet
  WHERE tweet_id = ${tweetId};`;

  const userIdFromTweet = await db.get(getUserIdFromTweet);
  console.log(userId.user_id);
  console.log(userIdFromTweet.user_id);
  if (userId.user_id === userIdFromTweet.user_id) {
    const deleteTweet = `
    DELETE from tweet WHERE tweet_id = ${tweetId};`;

    await db.run(deleteTweet);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

module.exports = app;
