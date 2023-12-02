const sRep = require("../Models/salesReport");
const { sendApiResult } = require("./helperController")

exports.dhWiseSalesReport = async (req,res)=>{
    try {
        const data = await sRep.dhWiseSalesReport(req.params.id, req.params.year);
        res.status(200).send(data);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}
