const LB = require("../Models/leaderBoardModel");
const { sendApiResult } = require("./helperController")

exports.getDh = async (req,res)=>{
    try {
        const lb = await LB.getLeaderBoardData(req.query.fi_id);
        res.status(200).send(lb);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.leaderBoardCalculation = async (req,res)=>{
    try {
        const lb = await LB.leaderBoardCalculation();
        res.status(200).send(lb);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}
