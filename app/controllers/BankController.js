const { sendApiResult, randomIntFromInterval, makeRandStr, getFiBaseDhids } = require("./helperController");

exports.giveCredit = async(req,res)=>{
    try {
        await setTimeout(function(){
            res.status(200).send({
                token: makeRandStr(50),
                status: 200
            });
        }, randomIntFromInterval(20,60));
        
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.getDhidsByFI = async(req,res)=>{
    try {
        const dh_ids = await getFiBaseDhids(req);
		res.status(200).send(dh_ids);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}
