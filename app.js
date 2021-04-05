
const http = require('http');
const https = require('https');
const fs = require('fs');
const querystring = require('querystring');

var SERVERURL = "44.192.94.127";
var SITE = ""; // "010f5caf-d924-4513-9b40-3350bbc2760c";
var ADMIN_USER_NAME = "admin";
var ADMIN_PW = "admin";

//Loading of Module Dependencies
var XMLWriter = require('xml-writer');
var request = require("request");
var express = require("express");
var jsxml = require("node-jsxml");
var app = express();

//Express middleware set up
//Express is a web framework for NodeJS. This is what we're using to act as a web server
app.set('views', __dirname + '/views');
app.engine('html', require('ejs').renderFile);
app.use(express.urlencoded());
app.use(express.static(__dirname + '/public'));
app.use(express.cookieParser('Ronaldinho'));
app.use(express.session());

var userIDs = {};
var projectIDs = {};

//Routes
app.get('/', function(req,res) {

	if(!req.session.authToken) {

		var reqxml = new XMLWriter();
		reqxml.startElement('tsRequest').startElement('credentials').writeAttribute('name', ADMIN_USER_NAME)
			.writeAttribute('password', ADMIN_PW).startElement('site').writeAttribute('contentUrl', '');
		request.post( 
			{
				url: 'http://' + SERVERURL + '/api/3.11/auth/signin',
				body: reqxml.toString(),
				headers: {'Content-Type': 'text/xml'}
			},

			function(err, response, body) {
				if(err) {
					req.session.err = err;
				} else {
					var bodyXML = new jsxml.XML(body);
					req.session.authToken = bodyXML.child('credentials').attribute("token").getValue();
					req.session.SiteID = bodyXML.child('credentials').child("site").attribute("id").getValue();
					req.session.UserID = bodyXML.child('credentials').child("user").attribute("id").getValue();
					console.log("Get My Token------------------"+req.session.authToken);
					console.log("Get My Site-id------------------"+req.session.SiteID);
					console.log("Get My User-id------------------"+req.session.UserID);
					
				}
				res.render("index.ejs", {
					err: req.session.err
				});
				// Only display the error once
				req.session.err = null;

				//console.log("Get My Token------------------"+response.credentials.token);
			}
		);	
	} else {
		res.render("index.ejs", {
			err: req.session.err
		});
		// Only display the error once
		req.session.err = null;

	}
});

app.get('/projects', function(req,res) {
	console.log("List of projects in the Tableau Server");
	
	request(
		{
			url: 'http://' + SERVERURL + '/api/3.11/sites/' + SITE + '?key=name',
			headers: {
				'Content-Type': 'text/xml',
				'X-Tableau-Auth': req.session.authToken
			}
		},
		function(err, response, body) {
			if(err) {
				req.session.err = err;
				res.redirect('/');
			} else {
				var bodyXML = new jsxml.XML(body);
				//req.session.SiteID = bodyXML.child('site').attribute("id").getValue();
				console.log("site id: " + req.session.SiteID);
			}
			request( 
				{
					url: 'http://' + SERVERURL + '/api/3.11/sites/' + req.session.SiteID + '/projects/',
					headers: {
						'Content-Type': 'text/xml',
						'X-Tableau-Auth': req.session.authToken
					}
				},
				function(err, response, body) {
					if(err) {
						req.session.err = err;
					} else {
						
						var bodyXML = new jsxml.XML(body);
						bodyXML.descendants('project').each(function(item, index) {
							projectIDs[item.attribute('name').getValue()] = item.attribute('id').getValue();
						});
						for(var project in projectIDs) {
							console.log(project + " " + projectIDs[project]);
						}
					}
					res.render("projects.ejs", {
						err: req.session.err,
						projectIDs: projectIDs
					});
					// Only display the error once
					req.session.err = null;
				}
			);	
		}
	);
});


// When a user submits the form to add a user, it makes a post request to /users and passes the name of the user
// via req.body.Username. the code below handles that post request by calling the REST API's function to add
// a user.
app.post('/users', function(req,res) {
	console.log("Request to add user: " + req.body.Username);
	request(
		{
			url: 'http://' + SERVERURL + '/api/3.11/sites/' + SITE + '?key=name',
			headers: {
				'Content-Type': 'text/xml',
				'X-Tableau-Auth': req.session.authToken
			}
		},

		function(err, response, body) {
			if(err) {
				req.session.err = err;
				res.redirect('/');
			} else {
				var bodyXML = new jsxml.XML(body);
				//req.session.SiteID = bodyXML.child('site').attribute("id").getValue();
				console.log("site id: " + req.session.SiteID);
			}
			// OK. We have the site, and we've stored it in the session cookie, now we add our new user to that site.

			//First, build the XML for the POST
			var reqxml = new XMLWriter();
			reqxml.startElement('tsRequest').startElement('user')
				.writeAttribute('name', req.body.Username).writeAttribute('role', 'Interactor')
				.writeAttribute('publish', 'true').writeAttribute('contentAdmin','false')
				.writeAttribute('suppressGettingStarted', 'true');
			request.post( 
				{
					url: 'http://' + SERVERURL + '/api/3.11/sites/' + req.session.SiteID + '/users/',
					body: reqxml.toString(),
					headers: {
						'Content-Type': 'text/xml',
						'X-Tableau-Auth': req.session.authToken
					}
				},
				function(err, response, body) {
					if(err) {
						req.session.err = err;
					} else {
						//If the request was succesful we get xml back that contains the id and name of the added user.
						var bodyXML = new jsxml.XML(body);
						var userID = bodyXML.child('user').attribute('id').getValue();
						var userName = bodyXML.child('user').attribute('name').getValue();
						console.log(userName + " added with user id " + userID);
					}
					res.redirect('/users');
				}
			);	
		}
	);	
});

// Navigating to /users with the browser (as opposed to making a POST to users) will render a page
// with the list of users on the server, on the specified site.
app.get('/users', function(req,res) {
	console.log("List of users requested.");
	request(
		{
			url: 'http://' + SERVERURL + '/api/3.11/sites/' + SITE + '?key=name',
			headers: {
				'Content-Type': 'text/xml',
				'X-Tableau-Auth': req.session.authToken
			}
		},
		function(err, response, body) {
			if(err) {
				req.session.err = err;
				res.redirect('/');
			} else {
				var bodyXML = new jsxml.XML(body);
				req.session.SiteID = bodyXML.child('site').attribute("id").getValue();
				console.log("site id: " + req.session.SiteID);
			}
			request( 
				{
					url: 'http://' + SERVERURL + '/api/3.11/sites/' + req.session.SiteID + '/users/',
					headers: {
						'Content-Type': 'text/xml',
						'X-Tableau-Auth': req.session.authToken
					}
				},
				function(err, response, body) {
					if(err) {
						req.session.err = err;
					} else {
						var bodyXML = new jsxml.XML(body);
						bodyXML.descendants('user').each(function(item, index) {
							userIDs[item.attribute('name').getValue()] = item.attribute('id').getValue();
						});
						for(var user in userIDs) {
							console.log(user + " " + userIDs[user]);
						}
					}
					res.render("users.ejs", {
						err: req.session.err,
						userIDs: userIDs
					});
					// Only display the error once
					req.session.err = null;
				}
			);	
		}
	);
});

// On the list of users page, a user can click on a user's name. That will link them to /users/<username>.
// This is the route that handles that. It queries for all of the workbooks published by that user and then
// prints them out.
app.get('/users/:user', function(req, res) {
	console.log('Requested: workbooks published by ' + req.params.user);
	var workbooks = [];
	request( 
		{
			url: 'http://' + SERVERURL + '/api/3.11/sites/' + req.session.SiteID 
				+ '/users/' + userIDs[req.params.user] + '/workbooks',
			headers: {
				'Content-Type': 'text/xml',
				'X-Tableau-Auth': req.session.authToken
			}
		},
		function(err, response, body) {
			if(err) {
				req.session.err = err;
			} else {
				var bodyXML = new jsxml.XML(body);
				bodyXML.descendants('workbook').each(function(item, index) {
					workbooks.push(item.attribute('name').getValue());
				});
				for(var i = 0; i < workbooks.length; i++) {
					console.log(workbooks[i]);
				}
			}
			res.render("user.ejs", {
				err: req.session.err,
				user: req.params.user,
				userID: userIDs[req.params.user],
				workbooks: workbooks
			});
			// Only display the error once
			req.session.err = null;
		}
	);	
});

var tableau = require('./functions/tableau');
var tickets = {};
app.get('/displayviz', function(req,res) {

	//get the ticket
	//ticket = '6EzZ0WZxTeK1NzdM2pi_jg==:JbSCvqIruLDWPHSODHizpGns'

	var ticket = tableau.getTicket(SERVERURL, 'DemoSite', 'admin', '', function(obj) {
        if (obj.result == "success") {
        	console.log("We got the ticket ==>" + obj.result)
          res.render("trustedticket.ejs", {
				ticket: obj.ticket
			});
          res.send({
            result: "Success",
            ticket: obj.ticket
          });
        } else {
          res.send({
            result: "Error2",
            error: obj.error
          });
        }
      });

	
	});	

	/****
	tableau.getTicket(SERVERURL, 'DemoSite', 'admin', '', function(obj) {
        if (obj.result == "success") {
        	console.log("We got the ticket ==>" + obj.result)
          res.render("trustedticket.ejs", {
				ticket: obj.ticket
			});
          res.send({
            result: "Success",
            ticket: obj.ticket
          });
        } else {
          res.send({
            result: "Error2",
            error: obj.error
          });
        }
      });
      ****/
});

app.get('/trustedticket2', function(req,res) {
	tableau.getTicket(SERVERURL, 'DemoSite', 'admin', '', function(obj) {
        if (obj.result == "success") {
        	console.log("We got the ticket ==>" + obj.result)
          res.send({
            result: "Success",
            ticket: obj.ticket
          });
        } else {
          res.send({
            result: "Error2",
            error: obj.error
          });
        }
      });
});

app.get('/trustedticket', function(req,res) {

	let url = new URL('http://' + SERVERURL + '/trusted');
    let body = {
        username: 'admin'
    };
    body['target_site'] = 'DemoSite';
    

    let postData = querystring.stringify(body);
    console.log(' => POST ' + url + ' ' + postData);

    let module = http;
    if (url.protocol === 'https:') {
        module = https;
    }

     req = module.request({
        method: 'POST',
        url: url,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
    	form: postData
    }, function (tableauServerResponse) {
        let ticketData = '';
        tableauServerResponse.on('data', function (chunk) {
            ticketData += chunk;
        });

        tableauServerResponse.on('end', function () {
            let contents = JSON.stringify(
                {
                    ticket: ticketData
                });
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(contents + '\n');
            console.log('200 POST /api - ' + contents);
        });
    });

    req.on('error', function (error) {
        console.log('ERROR: ' + error);
    });

    req.write(postData);
    req.end();
					
});

function processApiResponse(res, tableauServer, username, site) {
    let url = new URL(tableauServer + '/trusted');
    let body = {
        username: username
    };
    if (site) {
        body['target_site'] = site;
    }

    let postData = querystring.stringify(body);
    console.log(' => POST ' + url + ' ' + postData);

    let module = http;
    if (url.protocol === 'https:') {
        module = https;
    }

    let req = module.request({
        method: 'POST',
        hostname: url.hostname,
        path: '/trusted',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    }, function (tableauServerResponse) {
        let ticketData = '';
        tableauServerResponse.on('data', function (chunk) {
            ticketData += chunk;
        });

        tableauServerResponse.on('end', function () {
            let contents = JSON.stringify(
                {
                    ticket: ticketData
                    
                });
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(contents + '\n');
            console.log('200 POST /api - ' + contents);
        });
    });

    req.on('error', function (error) {
        console.log('ERROR: ' + error);
    });

    req.write(postData);
    req.end();
}

//Start this thing
var port = Number(process.env.PORT || 7200);
app.listen(port);
console.log("Listening on port " + port);