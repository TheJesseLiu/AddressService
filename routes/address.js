var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
router.use(bodyParser.raw());
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({extended: false}));
var AWS = require("aws-sdk");
AWS.config.update({region: "us-east-1"});
var baseURL = process.env.BASE_URL;
var personURL = process.env.PERSON_URL;
const querySet = {"postal_code":true,"country":true,"city":true, "startKey_id":true, "limit":true};

function addHateoas(item){
	item["links"] = [
		{"rel":"self", "href":baseURL+'/'+item.address_id},
		{"rel":"persons", "href":baseURL+'/'+item.address_id+"/person"}
	];
}

function processQuery(query, params){
	if(query.startKey_id!== undefined){
		params['ExclusiveStartKey'] = {address_id:query.startKey_id};
		delete query["startKey_id"]; 
	}
	if(query.limit!== undefined){
		params['Limit'] = query.limit;
		delete query["limit"];
	}

	Object.keys(query).forEach(function(key) {
		if(querySet[key]!==true){
			delete query[key]; 
		}
		else{
			if(params['FilterExpression']===undefined)  params['FilterExpression'] = "";
			else params['FilterExpression']+=" AND ";
			params['FilterExpression']+= key+"=:"+key;
			if(params['ExpressionAttributeValues']===undefined) params['ExpressionAttributeValues'] ={};
			params['ExpressionAttributeValues'][':'+key] = query[key];			
		}
	});	
	console.log(params);
}

router.get('/address', function(req, res) {
	let ddb = new AWS.DynamoDB.DocumentClient();
	console.log(req.query);
	let params = {
        TableName: "AddressTable",
        Limit: 20
    };  	
	processQuery(req.query, params);
 	
 

	ddb.scan(params, function(err, data) {
   		if (err) console.log(err, err.stack); // an error occurred
        else {
            // adding HATEOAS format
	    	for(let i=0; i<data.Items.length; i++){
	    		addHateoas(data.Items[i]);	
	    	}
		    if(data.LastEvaluatedKey!==undefined){
		    	q = req.originalUrl.split("?")[1]===undefined? "":req.originalUrl.split("?")[1]+"&";
		    	data["links"] = [
					{"rel":"next", "href":baseURL+"?"+q+"startKey_id="+data.LastEvaluatedKey.address_id}
		    	]
		    }
	    	res.send(data);
	    	res.end();
	    }
	});	    
});

//add new address
router.post('/address', function(req, res) {
	console.log(req.body);
	let ddb = new AWS.DynamoDB.DocumentClient();
	let add_id = req.body.address_id;
	let params = {
		TableName : 'AddressTable',
		Item: req.body,
		'ConditionExpression':'attribute_not_exists(address_id)',
	};
	ddb.put(params, function(err, data) {
		if (err) {
			res.status(400);
			res.send("Address Existed");
			console.log(err);
			res.end();
		}
		else {
			res.status(202);
			res.end();
		}
	});
});

router.get('/address/:add_id/', function(req, res) {
	let ddb = new AWS.DynamoDB.DocumentClient();
    let add_id = req.params.add_id;
	let params = {
	    TableName:'AddressTable',
	    Key: {
	      address_id: add_id
	    }
	};
	ddb.get(params, function(err, data) {
	    if (err || isNaN(add_id)) {
	    	console.log(err, err.stack); // an error occurred
	    	res.status(400);
	    	res.end("400 Bad Request or the id should be a number");
	    }
	    else {
	    	if(data.length!=0){
	    		addHateoas(data.Item);	    		
	    	}
	    	res.status(200).send(data);
	    	res.end();
	    }
	});
});



router.delete('/address/:add_id/', function(req, res) {
	let ddb = new AWS.DynamoDB.DocumentClient();
    let add_id = req.params.add_id;
	let params = {
	    TableName : 'AddressTable',
	    Key: {
	      address_id: add_id,
	    }
	};

	ddb.delete(params, function(err, data) {
	    if (err || isNaN(add_id)) {
	    	console.log(err);
	    	res.status(400);
	    	res.end("400 Bad Request or the add_id should be number");
	    }
	    else {
	    	res.status(204);
	    	res.end()
	    }
	});
});


router.get('/address/:add_id/person', function (req, res) {
	let ddb = new AWS.DynamoDB.DocumentClient();
    var add_id = req.params.add_id;
	let params = {
	    TableName : 'AddressTable',
	    Key: {
	      address_id: add_id,
	    }
	};
    ddb.get(params, function(err, data) {
        if (err) {
            console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
            res.status(400);
            res.end("400 Bad Request or the address_id should be number");
        } 
        else {
        	res.status(200).send(personURL+"?address_id="+data.Item.address_id);
        	res.end();
        }
    });
});

module.exports = router;

