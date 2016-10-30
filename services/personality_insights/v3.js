/**
 * Copyright 2015 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function (RED) {
  var PersonalityInsightsV3 = require('watson-developer-cloud/personality-insights/v3'),
    cfenv = require('cfenv'),
    payloadutils = require('../../utilities/payload-utils'),
    service = cfenv.getAppEnv().getServiceCreds(/personality insights/i),
    username = null,
    password = null,
    sUsername = null,
    sPassword = null,

    VALID_INPUT_LANGUAGES = ['ar','en','es','ja'],
    VALID_RESPONSE_LANGUAGES = ['ar','de','en','es','fr','it','ja','ko','pt-br','zh-cn','zh-tw'];

  if (service) {
    sUsername = service.username;
    sPassword = service.password;
  }

  // This HTTP GET REST request is used by the browser side of the node to
  // determine if credentials are found.
  RED.httpAdmin.get('/watson-personality-insights-v3/vcap', function (req, res) {
    res.json(service ? {bound_service: true} : null);
  });

  // This is the start of the Node Code. In this case only on input
  // is being processed.
  function Node(config) {
    RED.nodes.createNode(this,config);
    var node = this,
      wc = payloadutils.word_count(config.inputlang);

    this.on('input', function (msg) {
      //var self = this;

      if (!msg.payload) {
        var message = 'Missing property: msg.payload';
        node.status({fill:'red', shape:'ring', text:'missing payload'});
        node.error(message, msg)
        return;
      }

      if ('string' !== typeof(msg.payload)) {
        var message = 'submitted msg.payload is not text';
        node.status({fill:'red', shape:'ring', text:'payload is not text'});
        node.error(message, msg)
        return;
      }

      wc(msg.payload, function (length) {
        if (length < 100) {
          var message = 'Personality insights requires a minimum of one hundred words.'
                            + ' Only ' + length + ' submitted';
          node.status({fill:'red', shape:'ring', text:'insufficient words submitted'});
          node.error(message, msg);
          return;
        }

        username = sUsername || node.credentials.username;
        password = sPassword || node.credentials.password;

        if (!username || !password) {
          var message = 'Missing Personality Insights service credentials';
          node.status({fill:'red', shape:'ring', text:'missing credentials'});
          node.error(message, msg);
          return;
        }

        var personality_insights = new PersonalityInsightsV3({
          username: username,
          password: password,
          version_date: '2016-10-20'
        });

        var inputlang = config.inputlang ? config.inputlang : 'en';
        var outputlang = config.outputlang ? config.outputlang : 'en';

        if (msg.piparams) {
          if (msg.piparams.inputlanguage
                && -1 < VALID_INPUT_LANGUAGES.indexOf(msg.piparams.inputlanguage)) {
            inputlang =  msg.piparams.inputlanguage;
          }
          if (msg.piparams.responselanguage
                && -1 < VALID_RESPONSE_LANGUAGES.indexOf(msg.piparams.responselanguage)) {
            outputlang =  msg.piparams.responselanguage;
          }
        }

        var params = {
          text: msg.payload,
          consumption_preferences: config.consumption ? config.consumption : false,
          raw_scores: config.rawscores ? config.rawscores : false,
          headers: {
            'content-language': inputlang,
            'accept-language': outputlang,
            'accept': 'application/json'
          }
        };

        node.status({fill:"blue", shape:"dot", text:"requesting"});
        personality_insights.profile(params, function(err, response){
          node.status({})
          if (err) {
            node.status({fill:'red', shape:'ring', text:'processing error'});
            node.error(err, msg);
          } else{
            msg.insights = response;
          }

          node.send(msg);
        });

      });
    });
  }

  RED.nodes.registerType("watson-personality-insights-v3",Node,{
     credentials: {
      username: {type:"text"},
      password: {type:"password"}
    }
  });
};
