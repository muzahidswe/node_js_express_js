require('dotenv').config();
const express = require("express");
var fs = require('fs');
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const auth = require('./app/controllers/auth');
const kyc = require("./app/controllers/kycController");
const helper = require("./app/controllers/helperController");
const interestCalculation = require("./app/controllers/interestCalculationController");
const lbc = require("./app/controllers/leaderBoardController");
const disbursement = require("./app/controllers/disbursementController");
var https = require('https');
const app = express();

const loanLossClassification = require("./app/controllers/loanLossController");

app.use(cors());
var publicDir = require('path').join(__dirname, process.env.PUBLIC_URL);
app.use(express.static(publicDir));

// Add headers
/*app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8989');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    res.header("Access-Control-Allow-Origin", "*");
     res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

    // Pass to next layer of middleware
    next();
});*/

app.all('*', function (req, res, next) {
 //res.header("Access-Control-Allow-Origin", "*");
 res.setHeader('Access-Control-Allow-Origin', req.header('origin') || req.header('x-forwarded-host') || req.header('referer') || req.header('host'));
 res.header("Access-Control-Allow-Headers", "Content-Type,Content-Length, Authorization, Accept,X-Requested-With");
 res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
 next();
});



app.use(bodyParser.json({ limit: '1024mb' }));

// parse requests of content-type - application/json
app.use(bodyParser.json());

// parse requests of content-type - application/x-www-form-urlencoded
// app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({
	limit: '10mb',
	extended: true
}));

// simple route without auth
app.get("/", (req, res) => {
	console.log("server testing", req.ip);
  res.json({ message: "Hello apsis" });
});

app.post("/login", auth.login);
app.get("/fetch-porichoy-pdf-image/:outlet_code",kyc.fetchPorichoyPdfImage);
app.post("/base64", auth.base64_decode);
app.post("/common_login", auth.commonLogin);
app.post("/refresh-token", authenticateRefreshToken, auth.refreshToken);
// Verify JWT token @ Mahfuz
app.post("/verify-token", authenticateJwtToken, (req, res, next) => {
	console.log("verify-token", req.ip);
	return res.json({ status: 200, message: "Verified" });
});

app.get('/download/:dir_name/:file_name', helper.downloadFile);
app.get("/see/:dir_name/:file_name",helper.seeFile);
//Get routes from routes folder with auth
app.get("/interest_calculation/:type", interestCalculation.calculateDailyInterest);
app.get("/total_outstanding_calculation_daily", interestCalculation.calculateTotalOutstandingDaily);
app.get("/leaderboard_calculation", lbc.leaderBoardCalculation);
app.post('/get-outstanding-by-route-id',disbursement.getOutStandingByRouteId);
app.get("/calculate-provision-wise-outlet-classification",loanLossClassification.determindClassificationWiseOutlets);
app.use('/', authenticateToken, require("./app/routes/api"));
app.use(express.static(__dirname + process.env.PUBLIC_URL));
//app.use('/public', express.static('public'))

function authenticateRefreshToken(req, res, next) { 
    if (typeof req.body.refreshToken === 'undefined' || req.body.refreshToken == null) return res.sendStatus(401)
    const refreshToken = req.body.refreshToken;    
    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err) => {
        if (err){
            console.log(err)
            return res.sendStatus(403)
        }else{
            next()
        } 
    })
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (token == null) return res.sendStatus(401)

  jwt.verify(token, process.env.JWT_SECRET, (err) => {
    if (err){
      return res.sendStatus(403)
    }else{
      next()
    } 
  })
}

function authenticateJwtToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (token == null) return res.json({ status: 401, message: "Unauthorized" });

    jwt.verify(token, process.env.JWT_SECRET, (err) => {
      if (err){
        return res.json({ status: 200, message: "Forbidden" });
      }else{
        next()
      } 
    })
}

/*var https_options = {
	key: fs.readFileSync("/home/unnoti/cert/2022/www.unnoti.net.key"),
	cert: fs.readFileSync("/home/unnoti/cert/2022/www_unnoti_net.crt"),
	//ca: [
    //    fs.readFileSync('/home/unnoti/cert/2022/Comodobundle.crt'),
    //    fs.readFileSync('/home/unnoti/cert/2022/www_unnoti_netcabundle.crt')
	//]
	ca: [
        fs.readFileSync('/home/unnoti/cert/2022/secitogCABundle.crt')
	]
};

var httpsServer = https.createServer(https_options, app);

const PORT = process.env.PORT || 8989;

httpsServer.listen(PORT, () => {
  app.timeout = 2000000;
  console.log(`Server is running on port: ${PORT} Time: ${new Date()}.`);
});*/

//const PORT = 8989;
const PORT = 3001
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});

