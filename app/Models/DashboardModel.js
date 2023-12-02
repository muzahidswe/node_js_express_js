const knex = require('../config/database')
const { sendApiResult } = require('../controllers/helperController');
var moment = require('moment');

let Dashboard = function () { }

Dashboard.getData = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            const target_outlets = await knex('cr_retail_limit')
                                .where({ 'activation_status': 'Active' })
                                .whereIn("id_point", req.dpids)
                                .select(
                                    knex.raw(`count( DISTINCT cr_retail_limit.id_outlet) as total`)
                                ).first();
            const credit_availed_outlets = await knex('cr_credit_disbursements')
                                .leftJoin("retailers", "retailers.id", "cr_credit_disbursements.id_outlet")
                                .where({ 'cr_credit_disbursements.activation_status': 'Active' })
                                .whereIn("retailers.dpid", req.dpids)
                                .select(
                                    knex.raw(`count( DISTINCT cr_credit_disbursements.id_outlet) as total`)
                                ).first();
            const credit_taken_in_last_ten_days = await knex('cr_credit_disbursements')
                                .leftJoin("retailers", "retailers.id", "cr_credit_disbursements.id_outlet")
                                .where({ 'cr_credit_disbursements.activation_status': 'Active' })
                                .whereIn("retailers.dpid", req.dpids)
                                .whereRaw("cr_credit_disbursements.sys_date >= DATE_ADD( CURDATE(), INTERVAL - 10 DAY )")
                                .select(
                                    knex.raw(`DATE_FORMAT(cr_credit_disbursements.sys_date, "%d-%b-%y") AS date`),
                                    knex.raw(`sum( cr_credit_disbursements.credit_amount) AS amount`)
                                )
                                .groupBy("cr_credit_disbursements.sys_date");
            const bad_debts_outlets = await knex('cr_credit_disbursements')
                                .leftJoin("retailers", "retailers.id", "cr_credit_disbursements.id_outlet")
                                .innerJoin({ retail: "cr_retail_limit" }, "cr_credit_disbursements.id_outlet", "retail.id_outlet")
                                .join("cr_disbursement_wise_interest", "cr_disbursement_wise_interest.id_cr_credit_disbursement", "cr_credit_disbursements.id")
                                .where({ 'cr_credit_disbursements.activation_status': 'Active' ,
                                    "cr_disbursement_wise_interest.is_penalty_interest": 1,
                                    "retail.kyc_status": "Approved"
                                })
                                .whereNot("cr_credit_disbursements.due_amount", 0)
                                .whereIn("retailers.dpid", req.dpids)
                                .select(
                                    knex.raw(`count(cr_disbursement_wise_interest.is_penalty_interest) as total `)
                                ).groupBy("retail.outlet_code");
            let data = {
                "target_vs_credit_availed_outlets": {"target_outlets": target_outlets.total, "credit_availed_outlets": credit_availed_outlets.total},
                "credit_taken_in_last_ten_days":credit_taken_in_last_ten_days,
                "bad_debts_outlets":bad_debts_outlets ? bad_debts_outlets.length : 0
            }
            resolve(sendApiResult(true, "Dashboard Data Fetched Successfully", data));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Dashboard.getDataV2 = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            const fromDate = req.dateRange ? req.dateRange[0] : null;
            const toDate = req.dateRange ? req.dateRange[1] : null;            
            const sameDate = (fromDate && toDate && fromDate == toDate) ? true : false;
            let currentDate;
            if (fromDate && toDate) {
                currentDate = toDate;
            }else{
                currentDate = moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD');
            }
            const firstDate = moment(fromDate, 'YYYY-MM-DD'); 
            const secondDate = moment(toDate, 'YYYY-MM-DD');
            const dayDiff = secondDate.diff(firstDate, 'days');

            const outlets_in_scope = await knex('cr_retail_limit') 
                                // .join("cr_dh_fi", "cr_retail_limit.id_dh", "cr_dh_fi.id_dh")                               
                                .where(function() {
                                    this.where({ 'cr_retail_limit.activation_status': 'Active' })
                                    // this.where({ 'cr_dh_fi.cr_acctivation_status': '1' })
                                    // this.whereNot("cr_retail_limit.id_dh", 57)
                                    if (req.dpIds && req.dpIds.length) {
                                        this.whereIn("cr_retail_limit.id_point", req.dpIds);
                                    }
									this.whereNotIn("cr_retail_limit.id_point", [334,344])
                                })
                                .select(
                                    knex.raw(`count( DISTINCT cr_retail_limit.id_outlet) as total`)
                                ).first();
								
            const outlets_registered = await knex('cr_retail_limit')
                                .where(function() {
                                    this.where({ 'cr_retail_limit.activation_status': 'Active' })
                                    this.whereNot("cr_retail_limit.kyc_status", 'Initial');
                                    // this.whereNot("cr_retail_limit.id_dh", 57);
                                    if (req.dpIds && req.dpIds.length) {
                                        this.whereIn("cr_retail_limit.id_point", req.dpIds);
                                    }
									this.whereNotIn("cr_retail_limit.id_point", [334,344])
                                })
                                .select(
                                    knex.raw(`count( DISTINCT cr_retail_limit.id_outlet) as total`)
                                ).first();
								
            const outlets_cr_approved = await knex('cr_retail_limit')
                                .where(function() {
                                    this.where({ 
                                        'activation_status': 'Active',
                                        'limit_status': 'FI Confirmed' 
                                    })
                                    // this.whereNot("cr_retail_limit.id_dh", 57);
                                    if (req.dpIds && req.dpIds.length) {
                                        this.whereIn("cr_retail_limit.id_point", req.dpIds);
                                    }
									this.whereNotIn("cr_retail_limit.id_point", [334,344])
                                })
                                .select(
                                    knex.raw(`count( DISTINCT cr_retail_limit.id_outlet) as total`)
                                ).first();

            const total_disbursement_till_date = await knex('cr_credit_disbursements')
                                .innerJoin("retailers", "retailers.id", "cr_credit_disbursements.id_outlet")
                                .where(function() {
                                    // this.where({ 'cr_credit_disbursements.activation_status': 'Active' })
                                    if (req.dpIds && req.dpIds.length) {
                                        this.whereIn("retailers.dpid", req.dpIds);
                                    }
                                    if (sameDate) {
                                        this.where('cr_credit_disbursements.sys_date', '<=', currentDate);  
                                    }
                                    else if (!sameDate && fromDate && toDate) {
                                        this.whereBetween('cr_credit_disbursements.sys_date', [fromDate, toDate]);  
                                    }
									this.where({ 'cr_credit_disbursements.activation_status': 'Active' })                                    
                                })
                                .select(
                                    knex.raw(`IFNULL(sum( cr_credit_disbursements.credit_amount),0) AS amount`)
                                ).first();

            const total_collection_till_date = await knex('cr_credit_payments')
                                .innerJoin("retailers", "retailers.id", "cr_credit_payments.id_outlet")
                                .where(function() {
                                    if (req.dpIds && req.dpIds.length) {
                                        this.whereIn("retailers.dpid", req.dpIds);
                                    }
                                    if (sameDate) {
                                        this.where('cr_credit_payments.sys_date', '<=', currentDate);  
                                    }
                                    else if (!sameDate && fromDate && toDate) {
                                        this.whereBetween('cr_credit_payments.sys_date', [fromDate, toDate]);  
                                    }                                
                                })
                                .select(
                                    knex.raw(`IFNULL(sum( cr_credit_payments.paid_amount),0) AS amount`)
                                ).first();
								
            const collection_percentage_till_date = ((total_collection_till_date.amount / total_disbursement_till_date.amount) * 100);
            const bad_debts_outlets = await knex('cr_credit_disbursements')
                                .innerJoin("retailers", "retailers.id", "cr_credit_disbursements.id_outlet")
                                .innerJoin({ retail: "cr_retail_limit" }, "cr_credit_disbursements.id_outlet", "retail.id_outlet")
                                .join("cr_disbursement_wise_interest", "cr_disbursement_wise_interest.id_cr_credit_disbursement", "cr_credit_disbursements.id")
                                .where(function(){
                                    this.where({ 'cr_credit_disbursements.activation_status': 'Active' ,
                                        "cr_disbursement_wise_interest.is_penalty_interest": 1,
                                        "retail.kyc_status": "Approved"
                                    })
                                    this.whereNot("cr_credit_disbursements.due_amount", 0);
                                    if (req.dpIds && req.dpIds.length) {
                                        // this.whereIn("retailers.dpid", req.dpIds);
										this.whereIn("retail.id_point", req.dpIds);
                                    }
                                    if (sameDate) {
                                        this.where('cr_credit_disbursements.sys_date', '<=', currentDate);  
                                    }
                                    else if (!sameDate && fromDate && toDate) {
                                        this.whereBetween('cr_credit_disbursements.sys_date', [fromDate, toDate]);  
                                    } 
                                })
                                .select("retail.total_due").groupBy("retail.outlet_code");

            let no_of_due_outlets_and_amt = {};
            no_of_due_outlets_and_amt.total_outlets = bad_debts_outlets.length;
            no_of_due_outlets_and_amt.total_due_amt = 0;
            for (let index = 0; index < bad_debts_outlets.length; index++) {
                const element = bad_debts_outlets[index];
                no_of_due_outlets_and_amt.total_due_amt += parseFloat(element.total_due);
            }

            // const no_of_due_outlets_and_amt = await knex('cr_credit_disbursements')
            //                     .leftJoin("retailers", "retailers.id", "cr_credit_disbursements.id_outlet")
            //                     .innerJoin({ retail: "cr_retail_limit" }, "cr_credit_disbursements.id_outlet", "retail.id_outlet")
            //                     .where(function() {
            //                         this.where({
            //                             'cr_credit_disbursements.activation_status': 'Active',
            //                             "retail.kyc_status": "Approved" 
            //                         })
            //                         if (req.dpIds && req.dpIds.length) {
            //                             this.whereIn("retailers.dpid", req.dpIds);
            //                         }   
            //                         this.whereNot("cr_credit_disbursements.due_amount", 0);
            //                         if (sameDate) {
            //                             this.where('cr_credit_disbursements.sys_date', '<=', currentDate);  
            //                         }
            //                         else if (!sameDate && fromDate && toDate) {
            //                             this.whereBetween('cr_credit_disbursements.sys_date', [fromDate, toDate]);  
            //                         }                            
            //                     })
            //                     .select(
            //                         knex.raw(`count(cr_credit_disbursements.id_outlet) as total_outlets `),
            //                         knex.raw(`IFNULL(sum(cr_credit_disbursements.due_amount),0) as total_due_amt `)
            //                     ).first();

            const disbursed_outlet_and_amt_today = await knex('cr_credit_disbursements')
                                .innerJoin("retailers", "retailers.id", "cr_credit_disbursements.id_outlet")
                                .where(function() {
                                    this.where({ 'cr_credit_disbursements.activation_status': 'Active' })
                                    if (req.dpIds && req.dpIds.length) {
                                        this.whereIn("retailers.dpid", req.dpIds);
                                    }
                                    if (sameDate) {
                                        this.where('cr_credit_disbursements.sys_date', currentDate);  
                                    }
                                    else if (!sameDate && fromDate && toDate) {
                                        this.whereBetween('cr_credit_disbursements.sys_date', [fromDate, toDate]);  
                                    }                                     
                                })
                                .select(
                                    knex.raw(`IFNULL(sum( cr_credit_disbursements.credit_amount),0) AS amount`),
                                    knex.raw(`count( cr_credit_disbursements.id_outlet) AS total_outlets`)
                                ).first();
                                
            // const strike_rate_today = ((disbursed_outlet_and_amt_today.total_outlets / parseInt(outlets_cr_approved.total)) * 100) / (dayDiff ? dayDiff + 1 : 1);
            const allDayList = await getAllDayList(new Date(fromDate), new Date(toDate));			
			const strikeRatePercentage = await strikeRatePercentageCalculation(allDayList, req.dpIds);
			// const strikeRatePercentage = 0.00;
			
			let strike_date;
            if (sameDate) {
                strike_date = moment(currentDate, "YYYY-MM-DD").format('DD-MMM-YYYY');
            }
            else if (!sameDate && fromDate && toDate) {
                strike_date = moment(fromDate, "YYYY-MM-DD").format('DD-MMM-YYYY') +' to '+ moment(toDate, "YYYY-MM-DD").format('DD-MMM-YYYY');
            } 

            const till_date_credit_utilization = await knex('cr_credit_disbursements')                                
								.innerJoin("retailers", "retailers.id", "cr_credit_disbursements.id_outlet")
                                .innerJoin({ retail: "cr_retail_limit" }, "cr_credit_disbursements.id_outlet", "retail.id_outlet")
                                .where(function() {
                                    this.where({ 'cr_credit_disbursements.activation_status': 'Active' })
                                    if (req.dpIds && req.dpIds.length) {
                                        // this.whereIn("retailers.dpid", req.dpIds);
										this.whereIn("retail.id_point", req.dpIds);
                                    }
                                    if (sameDate) {
                                        this.where('cr_credit_disbursements.sys_date', '<=', currentDate);  
                                    }
                                    else if (!sameDate && fromDate && toDate) {
                                        this.whereBetween('cr_credit_disbursements.sys_date', [fromDate, toDate]);  
                                    }
                                })
                                .select(
                                    knex.raw(`IFNULL(sum((cr_credit_disbursements.credit_amount / retail.daily_limit)*100),0) AS cr_vs_daily_limit`),
                                    knex.raw(`IFNULL(sum((cr_credit_disbursements.credit_amount / cr_credit_disbursements.invoice_amount)*100),0) AS cr_vs_memo`),
                                    knex.raw(`IFNULL(count(cr_credit_disbursements.id_outlet),0) AS total_cr_no`)
                                ).first();

            const till_date_credit_utilization_against_daily_limit = till_date_credit_utilization.cr_vs_daily_limit / till_date_credit_utilization.total_cr_no;
            const till_date_credit_utilization_against_memo_value = till_date_credit_utilization.cr_vs_memo / till_date_credit_utilization.total_cr_no;
			
			const tillDateCreditUtilizationAgainstDailyLimit = await tillDateCreditUtilizationAgainstDailyLimitCalculation(req.requestType, new Date(fromDate), new Date(toDate), req.dpIds);
			
            const till_date_disbursement = await knex('cr_credit_disbursements')
                                .innerJoin("retailers", "retailers.id", "cr_credit_disbursements.id_outlet")
                                .where(function() {
                                    // this.where({ 'cr_credit_disbursements.activation_status': 'Active' })                                    
                                    if (sameDate) {
                                        this.where('cr_credit_disbursements.sys_date', '<=', currentDate);  
                                    }
                                    else if (!sameDate && fromDate && toDate) {
                                        this.whereBetween('cr_credit_disbursements.sys_date', [fromDate, toDate]);  
                                    }
									if (req.dpIds && req.dpIds.length) {
                                        this.whereIn("retailers.dpid", req.dpIds);
                                    }									
                                })
                                .select(
                                    knex.raw(`IFNULL(sum( cr_credit_disbursements.credit_amount),0) AS total_credit_taken`),
                                    knex.raw(`count( cr_credit_disbursements.id_outlet) AS no_of_disburse`),
                                    knex.raw(`(IFNULL(sum( cr_credit_disbursements.credit_amount),0) / count( cr_credit_disbursements.id_outlet)) AS avg_disp_per_outlet`)
                                ).first();
								
            const todays_disbursement = await knex('cr_credit_disbursements')
                                .innerJoin("retailers", "retailers.id", "cr_credit_disbursements.id_outlet")
                                .where(function() {
                                    // this.where({ 'cr_credit_disbursements.activation_status': 'Active' })                                    
                                    if (sameDate) {
                                        this.where('cr_credit_disbursements.sys_date', currentDate);
                                    }else if(!sameDate && fromDate && toDate){
                                        this.whereBetween('cr_credit_disbursements.sys_date', [fromDate, toDate]);  
                                    }
									if (req.dpIds && req.dpIds.length) {
                                        this.whereIn("retailers.dpid", req.dpIds);
                                    }
                                })
                                .select(
                                    knex.raw(`IFNULL(sum( cr_credit_disbursements.credit_amount),0) / ${dayDiff ? dayDiff + 1 : 1} AS total_credit_taken_amount`),
                                    knex.raw(`count( cr_credit_disbursements.id_outlet) / ${dayDiff ? dayDiff + 1 : 1} AS no_of_disburse`),
                                    knex.raw(`((IFNULL(sum( cr_credit_disbursements.credit_amount),0) / ${dayDiff ? dayDiff + 1 : 1}) / (count( cr_credit_disbursements.id_outlet) / ${dayDiff ? dayDiff + 1 : 1})) AS avg_disp_per_outlet`)
                                ).first();

            const till_date_collection = await knex('cr_credit_payments')
                                .innerJoin("retailers", "retailers.id", "cr_credit_payments.id_outlet")
                                .where(function() {
                                    if (req.dpIds && req.dpIds.length) {
                                        this.whereIn("retailers.dpid", req.dpIds);
                                    }
                                    if (sameDate) {
                                        this.where('cr_credit_payments.sys_date', '<=', currentDate);  
                                    }else if (!sameDate && fromDate && toDate) {
                                        this.whereBetween('cr_credit_payments.sys_date', [fromDate, toDate]);  
                                    }                                
                                })
                                .select(
                                    knex.raw(`IFNULL(sum( cr_credit_payments.paid_amount),0) AS total_collection_amount`),
                                    knex.raw(`count( cr_credit_payments.id_outlet) AS no_of_collections`),
                                    knex.raw(`(IFNULL(sum( cr_credit_payments.paid_amount),0) / count( cr_credit_payments.id_outlet)) AS avg_collection_per_outlet`)
                                ).first();

            const todays_collection = await knex('cr_credit_payments')
                                .innerJoin("retailers", "retailers.id", "cr_credit_payments.id_outlet")
                                .where(function() {
                                    if (req.dpIds && req.dpIds.length) {
                                        this.whereIn("retailers.dpid", req.dpIds);
                                    }
                                    if (sameDate) {
                                        this.where('cr_credit_payments.sys_date', currentDate);       
                                    }else if (!sameDate && fromDate && toDate) {
                                        this.whereBetween('cr_credit_payments.sys_date', [fromDate, toDate]);  
                                    }                           
                                })
                                .select(
                                    knex.raw(`IFNULL(sum( cr_credit_payments.paid_amount),0) / ${dayDiff ? dayDiff + 1 : 1} AS total_collection_amount`),
                                    knex.raw(`count( cr_credit_payments.id_outlet) / ${dayDiff ? dayDiff + 1 : 1} AS no_of_collections`),
                                    knex.raw(`((IFNULL(sum( cr_credit_payments.paid_amount),0) / ${dayDiff ? dayDiff + 1 : 1}) / (count( cr_credit_payments.id_outlet) / ${dayDiff ? dayDiff + 1 : 1})) AS avg_collection_per_outlet`)
                                ).first();            
            
            const last_ten_day_trend = await knex('cr_credit_disbursements')
                                .innerJoin("retailers", "retailers.id", "cr_credit_disbursements.id_outlet")
                                .where(function() {
                                    this.where({ 'cr_credit_disbursements.activation_status': 'Active' })
                                    if (req.dpIds && req.dpIds.length) {
                                        this.whereIn("retailers.dpid", req.dpIds);
                                    }
                                    if (sameDate) {
                                        this.whereRaw("cr_credit_disbursements.sys_date >= DATE_ADD( '"+currentDate+"', INTERVAL - 10 DAY )")
                                    }else{
                                        if (dayDiff && dayDiff > 10) {
                                            this.whereRaw("cr_credit_disbursements.sys_date >= DATE_ADD( '"+toDate+"', INTERVAL - 10 DAY )")
                                        }else if(dayDiff && dayDiff <= 10 && fromDate && toDate){
                                            this.whereBetween('cr_credit_disbursements.sys_date', [fromDate, toDate]);  
                                        }else{
                                            this.whereRaw("cr_credit_disbursements.sys_date >= DATE_ADD( CURDATE(), INTERVAL - 10 DAY )")
                                        }
                                    }                              
                                })                                
                                .select(
                                    knex.raw(`CONCAT(DATE_FORMAT(cr_credit_disbursements.sys_date, "%d %b %Y"), ' GMT') AS date`),
                                    knex.raw(`IFNULL(sum( cr_credit_disbursements.credit_amount),0) AS amount`),
                                    knex.raw(`count( cr_credit_disbursements.id_outlet) AS no_of_outlet`)
                                )
                                .groupBy("cr_credit_disbursements.sys_date");

            let data = {
                "outlets_in_scope": outlets_in_scope.total ? outlets_in_scope.total : 0,
                "outlets_registered":outlets_registered.total ? outlets_registered.total : 0,
                "outlets_cr_approved":outlets_cr_approved.total ? outlets_cr_approved.total : 0,
                "collection_percentage_till_date": collection_percentage_till_date ? collection_percentage_till_date.toFixed(2) : 0,
                "no_of_due_outlets_and_amt": no_of_due_outlets_and_amt,
                // "strike_rate_today": strike_rate_today ? strike_rate_today.toFixed(2) : 0,
				"strike_rate_today": strikeRatePercentage ? strikeRatePercentage.toFixed(2) : 0,
                "strike_date": strike_date,
                // "till_date_credit_utilization_against_daily_limit": till_date_credit_utilization_against_daily_limit ? till_date_credit_utilization_against_daily_limit.toFixed(2) : 0,
				"till_date_credit_utilization_against_daily_limit": tillDateCreditUtilizationAgainstDailyLimit ? tillDateCreditUtilizationAgainstDailyLimit : 0,
                "till_date_credit_utilization_against_memo_value": till_date_credit_utilization_against_memo_value ? till_date_credit_utilization_against_memo_value.toFixed(2) : 0,
                "till_date_disbursement": till_date_disbursement,
                "todays_disbursement": todays_disbursement,
                "till_date_collection": till_date_collection,
                "todays_collection": todays_collection,
                "last_ten_day_trend": last_ten_day_trend
            }
            resolve(sendApiResult(true, "Dashboard V2 Data Fetched Successfully", data));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

const strikeRatePercentageCalculation = async function (dateArray, dpIds) {
	try {
       if (dateArray.length > 0) {
			var strikeRatePercentageArray = [];
            for(var i=0;i<dateArray.length;i++){
                var date = dateArray[i];
                const CalculationByDate = await strikeRatePercentageCalculationByDate(date, dpIds);
				strikeRatePercentageArray.push(CalculationByDate);
            }
			let strikeRatePercentSum = strikeRatePercentageArray.reduce(function(a, b){
				return a + b;
			}, 0);
			let strikeRatePercent = parseInt(strikeRatePercentSum / strikeRatePercentageArray.length);
			return strikeRatePercent;
        }   
	} catch (error) {
        return sendApiResult(false, error.message);
    }
}

const strikeRatePercentageCalculationByDate = async function (date, dpIds) {
	return new Promise(async (resolve, reject) => {
        try {
			let days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
			let dateObj = new Date(date);
			let weekdayNumber = dateObj.getDay();
			let dayName = days[weekdayNumber];
			
			const outlets_cr_approved = await knex('cr_retail_limit')
									.innerJoin('retailers', 'retailers.id', 'cr_retail_limit.id_outlet')
									.innerJoin('routes', 'retailers.rtid', 'routes.id')
									.innerJoin('section_days', 'routes.section', 'section_days.section')
									.whereIn('cr_retail_limit.id_point', dpIds)
									.whereNotIn('cr_retail_limit.id_point', [334,344])
									.andWhere('cr_retail_limit.activation_status', 'Active')
									.andWhere('cr_retail_limit.limit_status', 'FI Confirmed')
									// .andWhereNot('cr_retail_limit.id_dh', 57)
									.andWhere('retailers.stts', 1)
									// .andWhere('routes.stts', 1)
									.andWhere('section_days.'+dayName, 1)									
									.select(
										knex.raw(`count( DISTINCT cr_retail_limit.id_outlet) as total_outlets`)
									).first();
											
			const creditDisbursementsByDate = await knex('cr_credit_disbursements')
									.innerJoin('retailers', 'retailers.id', 'cr_credit_disbursements.id_outlet')
									.innerJoin('routes', 'retailers.rtid', 'routes.id')
									.innerJoin('section_days', 'routes.section', 'section_days.section')
									.where('cr_credit_disbursements.sys_date', date)
									.whereIn('retailers.dpid', dpIds)
									.andWhere('cr_credit_disbursements.activation_status', 'Active')
									.andWhere('retailers.stts', 1)
									// .andWhere('routes.stts', 1)
									.andWhere('section_days.'+dayName, 1)
									.select(
										knex.raw(`count( DISTINCT cr_credit_disbursements.id_outlet) AS total_outlets`)
									).first();
						
			const strikeRatePercentage = parseFloat(((parseInt(creditDisbursementsByDate.total_outlets) / parseInt(outlets_cr_approved.total_outlets)) * 100).toFixed(2));
			resolve(strikeRatePercentage);
		} catch (error) {			
			reject(error.message)
		}
    })
}

const tillDateCreditUtilizationAgainstDailyLimitCalculation = async function (requestType, fromDate, toDate, dpIds) {	
	try {
		// to prepare date format || fromDate
		let fromYear = fromDate.getFullYear();
		let fromMonth = ("0" + (fromDate.getMonth() + 1)).slice(-2);
		let fromDay = ("0" + fromDate.getDate()).slice(-2);
		let startDate = fromYear + '-' + fromMonth + '-' + fromDay;		
		
		// to prepare date format || toDate
		let endYear = toDate.getFullYear();
		let endMonth = ("0" + (toDate.getMonth() + 1)).slice(-2);
		let endDay = ("0" + toDate.getDate()).slice(-2);
		let endDate = endYear + '-' + endMonth + '-' + endDay;
		
		const utilizationAgainstDaily = await knex('cr_credit_disbursements')
									.innerJoin('retailers', 'retailers.id', 'cr_credit_disbursements.id_outlet')
									.where(function() {
										this.whereIn('retailers.dpid', dpIds);										
										if (requestType == 'filtered') {
											this.whereBetween('cr_credit_disbursements.sys_date', [startDate, endDate]);
										}
										this.where({ 'retailers.stts': 1 });
									})
									.select(
										knex.raw(`AVG(cr_credit_disbursements.util_rate_against_daily_limit) AS utilizationAgainstDaily`)
									).first();
									
		return utilizationAgainstDaily.utilizationAgainstDaily;
	} catch (error) {
        return sendApiResult(false, error.message);
    }
}

const getAllDayList = function (startDate, endDate) {
	const dates = [];
	let currentDate = startDate;
	const addDays = function (days) {
		const date = new Date(this.valueOf());
		date.setDate(date.getDate() + days);
		return date;
	}
	while (currentDate <= endDate) {
		let days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
		let dateObj = new Date(currentDate);
		let weekdayNumber = dateObj.getDay();
		if(days[weekdayNumber] != 'Friday'){
			let year = currentDate.getFullYear();
			let month = ("0" + (currentDate.getMonth() + 1)).slice(-2);
			let day = ("0" + currentDate.getDate()).slice(-2);
			let date = year + '-' + month + '-' + day;
			dates.push(date);
		}
		currentDate = addDays.call(currentDate, 1);
	}
	return dates;
}

module.exports = Dashboard;