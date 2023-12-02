const { sendApiResult } = require("./helperController");
const calculationModel = require("../Models/interestCalculationModel");

exports.calculateDailyInterest = async (req,res) =>{
    try {
        var calculateinterest;
        if (req.params.type == 'sys') {
            calculateinterest = await calculateDailyInterestForSys(req);
        }else{
            calculateinterest = await calculateDailyInterestForFi(req);
        }
        
        res.status(200).send(calculateinterest);
    } catch (error) {
        console.log("adeqd")
        res.send(sendApiResult(false,error.message));
    }
}

// Total Outstanding Calculation By Mahfuz
exports.calculateTotalOutstandingDaily = async (req, res) => {
	try {
		const totalOutstanding = await calculationModel.calculateTotalOutstandingDaily();
		res.status(200).send(sendApiResult(true, totalOutstanding));
	} catch (error) {
        console.log("adeqd")
        res.send(sendApiResult(false,error.message));
    }
}

const calculateDailyInterestForSys = async function (req){
    try {
        var calculate = await calculationModel.calculateDailyInterestForSys(req);
        return calculate;
    } catch (error) {
        return sendApiResult(false,'Job Not Done');
    }
}

const calculateDailyInterestForFi = async function (req){
    try {
        var calculate = await calculationModel.calculateDailyInterestForFi(req);
        return calculate;
    } catch (error) {
        return sendApiResult(false,'Job Not Done');
    }
}