﻿/*

This file is part of Streembit application. 
Streembit is an open source communication application. 

Streembit is a free software: you can redistribute it and/or modify it under the terms of the GNU General Public License 
as published by the Free Software Foundation, either version 3.0 of the License, or (at your option) any later version.

Streembit is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty 
of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with Streembit software.  
If not, see http://www.gnu.org/licenses/.
 
-------------------------------------------------------------------------------------------------------------------------
Author: Streembit team
Copyright (C) Streembit 2017
-------------------------------------------------------------------------------------------------------------------------

*/

'use strict';

const bs58check = require('bs58check');
const createHash = require('create-hash');
const appsrvc = require('appsrvc');
const peermsg = require('peermsg');
const Buffer = require('jspm/nodelibs-buffer').Buffer;
const transport = require('transport').default;

function Contact(contact) {

    var handler = {};

    this.contact = contact;

    this.get_contact_offer = function (transport, param, callback) {
            if (!param) {
                callback("getcontact offer error: invalid contact parameter");
            }

            var account = param.name;            

            var key = param.pkeyhash + "/" + appsrvc.pubkeyhash;

            transport.get(key, (err, result) => {
                try {
                    if (err) {
                        return callback(err);
                    }

                    if (!result) {
                        return callback("contact offer does not exists for " + account);
                    }

                    // the WS peer sends back a payload.value object, validate and handle that
                    var msg;
                    if (result.value && typeof result.value == "string" ) {
                        msg = result.value;
                    }
                    else {
                        msg = result;
                    }

                    // parse the message
                    var payload = peermsg.getpayload(msg);
                    if (!payload || !payload.data || !payload.data.type || payload.data.type != peermsg.MSGTYPE.CAMSG) {
                        return callback("get_contact_offer error: invalid contact payload");
                    }

                    var isspkey = payload.iss;
                    if (isspkey != param.public_key) {
                        return callback("get contact offer error: public key mismatch with contact: " + account + ", new contact request is required");
                    }

                    var decoded = peermsg.decode(msg, param.publickeyhex);
                    if (!decoded || !decoded.data.cipher) {
                        return callback("get_contact_offer error: invalid decoded contact payload");
                    }

                    var cipher = decoded.data.cipher;
                    var plaintext = peermsg.ecdh_decrypt(appsrvc.cryptokey, param.publickeyhex, cipher);
                    var connection = JSON.parse(plaintext);
                    if (!connection) {
                        return callback("get_contact_offer error: no connection details field is published from contact " + account);
                    }

                    if (connection.account != account) {
                        return callback("get_contact_offer error: account mismatch was published from contact " + account);
                    }

                    var address = connection[peermsg.MSGFIELD.HOST];
                    if (!address) {
                        return callback("get_contact_offer error: no address field is published from contact " + account);
                    }

                    var port = connection[peermsg.MSGFIELD.PORT];
                    if (!port) {
                        return callback("get_contact_offer error: no port field is published from contact " + account);
                    }

                    var protocol = connection[peermsg.MSGFIELD.PROTOCOL];
                    if (!protocol) {
                        return callback("get_contact_offer error: no protocol field is published from contact " + account);
                    }

                    var connsymmkey = connection[peermsg.MSGFIELD.SYMKEY];
                    if (!connsymmkey) {
                        return callback("get_contact_offer error: no connsymmkey field is published from contact " + account);
                    }

                    var pkey = connection.public_key;
                    if (!pkey || pkey != isspkey) {
                        return callback("get_contact_offer error: public key mismatch for contact " + account);
                    }

                    var utype = connection[peermsg.MSGFIELD.UTYPE];
                    var avatar = this.contact.avatar;

                    var contact = {
                        public_key: pkey,
                        address: address,
                        port: port,
                        name: account,
                        avatar: avatar,
                        user_type: utype,
                        protocol: protocol,
                        pkeyhash: param.pkeyhash,
                        publickeyhex: param.publickeyhex,
                        connkey: connsymmkey
                    };

                    callback(null, contact);
                }
                catch (e) {
                    callback(e.message);
                }
            })
    };

    this.find = function (completefn) {
        try {
            var self = this;

            transport.get_contact_transport(this.contact.address, this.contact.port, (err, transport) => {
                if (err) {
                    return completefn(err);
                }
                if (!transport) {
                    return completefn("find contact error, failed to create network object")
                }

                this.get_contact_offer(
                    transport,
                    self.contact, 
                    (err, contact) => {
                        completefn(err, contact);
                    }
                );
            });
            
        }
        catch (err) {
            completefn(err);
        }
    };

}


module.exports = Contact;