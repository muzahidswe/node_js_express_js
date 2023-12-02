const { sendApiResult, getSettingsValue } = require("./helperController")
const Disbursement = require("../Models/Disbursements");

exports.takeNewCredit = async (req,res)=>{
    try {
        console.log(req.body);
        const current = new Date();
        const maxHrAllowed = parseInt(await getSettingsValue('hr', 'max_sales_time_allowed'));
        const maxMinAllowed = parseInt(await getSettingsValue('min', 'max_sales_time_allowed'));
        const maxTimeAllowed = maxHrAllowed + (maxMinAllowed / 60);
        if ((current.getHours() + (current.getMinutes() / 60)) < maxTimeAllowed) {
            const result =await Disbursement.takeNewCredit(req.body);
            res.status(200).send(result);
        }
        else{
            // res.send(sendApiResult(false,'Daily Allowed Time for Transaction Exceeded!', {status:405}));
			if(req.body.hasOwnProperty('take_credit') && req.body.take_credit == 'offline'){
				const result =await Disbursement.takeNewCredit(req.body);
				res.status(200).send(result);
			}
			else {
				res.send(sendApiResult(false,'Daily Allowed Time for Transaction Exceeded!', {status:405}));
			}			
        }        
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.outletCreditPayment = async(req,res)=>{
    try {
        const current = new Date();
        const maxHrAllowed = parseInt(await getSettingsValue('hr', 'max_sales_time_allowed'));
        const maxMinAllowed = parseInt(await getSettingsValue('min', 'max_sales_time_allowed'));
        const maxTimeAllowed = maxHrAllowed + (maxMinAllowed / 60);
        if ((current.getHours() + (current.getMinutes() / 60)) < maxTimeAllowed) {
            const result = await Disbursement.outletCreditPayment(req.body);
            res.status(200).send(result);
        }
        else{
            res.send(sendApiResult(false,'Daily Allowed Time for Transaction Exceeded!'));
        }
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.checkTodaysCredit = async(req,res)=>{
    try {
        const outlet_id = req.params.id_outlet;
        console.log('The id: '+outlet_id);
        const status = await Disbursement.checkTodaysCredit(outlet_id);
        res.status(200).send(status);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.checkLiveSyncStatus = async(req, res) => {
    try {
        const id_point = req.params.id_point;
        const status = await Disbursement.checkLiveSyncStatus(id_point);
        res.status(200).send(status);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.getInterestSettings = async(req, res) => {
    try {
        const id_point = req.params.id_point;
        const status = await Disbursement.getInterestSettings(id_point);
        res.status(200).send(status);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.getOutStandingByRouteId = async(req, res) => {
    try {
        const result = await Disbursement.getOutStandingByRouteId(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}