
const { leftJoin } = require('../config/database')
const knex = require('../config/database')
const { sendApiResult } = require('../controllers/helperController')
let sRep = function(){}

sRep.dhWiseSalesReport = function(id_dh, year){
    return new Promise(async (resolve, reject) => {
        try {
            const data = await knex.from("cr_sales_history").select("cr_sales_history.id","cr_sales_history.month", "cr_sales_history.year", 
            "cr_sales_history.top_sale_amount", "cr_sales_history.id_dh", "cr_sales_history.id_outlet")
            .where('cr_sales_history.id_dh',id_dh)
            .where('cr_sales_history.year',year);
            resolve(sendApiResult(true, "Yearly sales report fetched successfully", data));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

module.exports = sRep;