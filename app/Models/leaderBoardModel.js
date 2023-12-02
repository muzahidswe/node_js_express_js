const { leftJoin } = require('../config/database')
const knex = require('../config/database')
const { sendApiResult,getFiBaseDpids } = require('../controllers/helperController')
const moment = require('moment');
let LB = function(){}

LB.getDh = function(){
    return new Promise(async (resolve, reject) => {
        try {
            const get_fi = await knex.from("company").select("id","name").orderBy('name', 'asc');
            resolve(sendApiResult(true, "DH fetched successfully", get_fi));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

LB.getLeaderBoardData = async function(req){
	const dpids = await getFiBaseDpids(req);
	
    return new Promise(async (resolve, reject) => {
        try {
            const d = new Date(); // Today!
            const pdate =  moment(d.setDate(d.getDate() - 1)).format('YYYY-MM-DD');
			/*
            const get_lbdata = await knex.from("distributorspoint")
								.select("area.slug as area",
								"territory.slug as territory",
								"distributorspoint.territory as territory_id",
								knex.raw(`COUNT(id_outlet) AS total_scope`),
								knex.raw(`SUM(IF(cr_retail_limit.kyc_status != "Initial",1,0)) as ac`),
								"cr_leader_board_ranking.ranking as last_day_ranking")
								.leftJoin("cr_retail_limit", "cr_retail_limit.id_point", "distributorspoint.id")
								.innerJoin("_locations AS territory", " distributorspoint.territory", "territory.id")
								.innerJoin("_locations AS area", "distributorspoint.area", "area.id")
								.innerJoin("cr_leader_board_ranking", "distributorspoint.territory", "cr_leader_board_ranking.territory_id")
								.whereNotIn("distributorspoint.id", [334,344])
								.where("cr_leader_board_ranking.date", pdate)
								.groupBy("distributorspoint.territory");
			*/
			const phase_ids = await knex("cr_retail_phase").select("id AS phase_id").where("leaderboard_status", 1).where("status", 1);
			var phase_id_list = [];
			for (const [key, value] of Object.entries(phase_ids)){
				phase_id_list.push(parseInt(value.phase_id));
			}
			const get_lbdata = await knex.from("cr_retail_limit")
								.select("area.slug as area",
								// "area.id as area_id",
								"am_user.name AS am_name",
								"am_user.image_path AS am_image_path",
								"territory.slug as territory",
								// "distributorspoint.territory as territory_id",
								"to_user.name AS to_name",
								"to_user.image_path AS to_image_path",
								knex.raw(`max(cr_retail_limit.kyc_time) AS max_kyc_time`),
								knex.raw(`COUNT(cr_retail_limit.id_outlet) AS total_scope`),
								knex.raw(`SUM(IF(cr_retail_limit.kyc_status != "Initial",1,0)) as ac`),
								"cr_leader_board_ranking.ranking as last_day_ranking",
								knex.raw(`(SUM( IF ( cr_retail_limit.kyc_status != "Initial", 1, 0 ))/COUNT( cr_retail_limit.id_outlet )) AS achievement_perchantage`)								
								)
								.where(function () {
									if (dpids) {
										this.whereIn("cr_retail_limit.id_point", dpids);
									}
								})
								.innerJoin("distributorspoint", "cr_retail_limit.id_point", "distributorspoint.id")
								.innerJoin("_locations AS territory", "distributorspoint.territory", "territory.id")
								.innerJoin("_locations AS area", "distributorspoint.area", "area.id")
								.leftJoin("cr_leaderboard_user_location_mapping AS to_mapping", "distributorspoint.territory", "to_mapping.territory_id")
								.leftJoin("cr_leaderboard_user AS to_user", "to_user.id", "to_mapping.user_id")
								.leftJoin("cr_leaderboard_user_location_mapping AS am_mapping", "distributorspoint.area", "am_mapping.area_id")
								.leftJoin("cr_leaderboard_user AS am_user", "am_user.id", "am_mapping.user_id")
								.innerJoin("cr_leader_board_ranking", "distributorspoint.territory", "cr_leader_board_ranking.territory_id")
								// .whereNotIn("distributorspoint.id", [334,344])
								.where("cr_leader_board_ranking.sys_date", pdate)
								.where("cr_retail_limit.activation_status", 'Active')
								.whereIn("cr_retail_limit.phase_id", phase_id_list)
								// .where("cr_leaderboard_user.status", 1)
								// .where("cr_leaderboard_user_location_mapping.status", 1)
								.orderBy("achievement_perchantage", "DESC")
								.orderBy("cr_retail_limit.kyc_time", "DESC")
								.groupBy("distributorspoint.territory");
								//.limit(10);
			
            resolve(sendApiResult(true, "Leader Board Data Fetched Successfully", get_lbdata));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

LB.leaderBoardCalculation = function(){
	
    return new Promise(async (resolve, reject) => {
        try {

			const phase_ids = await knex("cr_retail_phase").select("id AS phase_id").where("leaderboard_status", 1).where("status", 1);
			var phase_id_list = [];
			for (const [key, value] of Object.entries(phase_ids)){
				phase_id_list.push(parseInt(value.phase_id));
			}
			
			const d = new Date(); // Today!
            const pdate =  moment(d.setDate(d.getDate() - 1)).format('YYYY-MM-DD');
			
			const get_lbdata = await knex.from("cr_retail_limit")
								.select("area.slug as area",
								"area.id as area_id",
								"territory.slug as territory",
								"distributorspoint.territory as territory_id",
								knex.raw(`COUNT(cr_retail_limit.id_outlet) AS total_scope`),
								knex.raw(`SUM(IF(cr_retail_limit.kyc_status != "Initial",1,0)) as ac`),
								)
								.innerJoin("distributorspoint", "cr_retail_limit.id_point", "distributorspoint.id")
								.innerJoin("_locations AS territory", " distributorspoint.territory", "territory.id")
								.innerJoin("_locations AS area", "distributorspoint.area", "area.id")
								.whereNotIn("distributorspoint.id", [334,344])
								.where("cr_retail_limit.activation_status", 'Active')
								.whereIn("cr_retail_limit.phase_id", phase_id_list)
								.groupBy("distributorspoint.territory");
								
			var board_details = [];
			var ac_perchantage = [];
			var perchantage = [];
			if(get_lbdata.length != 0){
				for (const [key, value] of Object.entries(get_lbdata)){
					var temp_data = {};
					// temp_data.area = value.area;
					temp_data.area_id = value.area_id;
					// temp_data.territory = value.territory;
					temp_data.territory_id = value.territory_id;
					temp_data.total_scope = value.total_scope;
					temp_data.ac = value.ac;
					temp_data.ac_perchantage = parseFloat((value.ac / value.total_scope) * 100).toFixed(2);
					temp_data.ranking = null;
					temp_data.rank_vs_lastdate = '-';
					temp_data.sys_date = pdate;
					perchantage.push(temp_data.ac_perchantage);
					perchantage.sort();
					board_details.push(temp_data);
				}
				ac_perchantage = perchantage.reverse();
			}
			
			var leader_board_details = [];
			for (const [key, value] of Object.entries(board_details)){
				var temp_data = {};
				// temp_data.area = value.area;
				temp_data.area_id = value.area_id;
				// temp_data.territory = value.territory;
				temp_data.territory_id = value.territory_id;
				temp_data.total_scope = parseInt(value.total_scope);
				temp_data.achievement = parseInt(value.ac);
				temp_data.achievement_perchantage = parseFloat(value.ac_perchantage).toFixed(2);
				temp_data.ranking = parseInt(ac_perchantage.indexOf(value.ac_perchantage) + 1);
				temp_data.rank_vs_lastdate = '-';
				temp_data.sys_date = pdate;
				leader_board_details.push(temp_data);
			}
			
			await knex("cr_leader_board_ranking").insert(leader_board_details);
						
            resolve(sendApiResult(true, "Leader Board Data Insert Successfully", leader_board_details));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
	
}

module.exports = LB;