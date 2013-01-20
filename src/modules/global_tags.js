remoteStorage.defineModule('tags', function(privateClient, publicClient) {
  var curry = remoteStorage.util.curry;
  var asyncEach = remoteStorage.util.asyncEach;

  //"use strict";
  var moduleName = 'tags';
  privateClient.use('');
  publicClient.use('');

  privateClient.declareType('tag', {
    "description": "a method of tracking tags and references to the module records that they've been related to",
    "type":"array",
    "items": {
      "title": "a collection of record id's associated with this tag name + docType",
      "type": "string"
    }
  });

  privateClient.declareType('reverse', {
    "description": "a method of tracking tags and references to the module records that they've been related to",
    "type":"array",
    "items": {
      "title": "a collection of tags names associated with this record ID + docType",
      "type": "string"
    }
  });

  return {
    name: moduleName,

    dataHints: {
      "module" : "A globally accessible record of tag names, which you can attach to items in other modules"
    },

    exports: {

      getPrivateListing: function(docType) {
        var pub = {};
        var _ = {};
        _.docType = docType;

        pub.on = privateClient.on;

        /**
         * get list of all tags of any docType
         * @returns {array}
         */
        pub.getAllTags = function() {
          console.log('TAGS: getAllTags()');
          return privateClient.getListing('names/').
            then(function(tags) {
              var num_tags = tags.length;
              var r_tags = [];
              for (var i = 0; i < num_tags; i++) {
                r_tags.push(tags[i].replace(/\//g,""));
              }
              return r_tags;
            });
        };

        /**
         * get a list of all tags which have a specified record ID
         * @param {string} record id
         * @returns {array} array of tag names
         */
        pub.getTagsByRecord = function(recordId) {
          //console.log("TAGS: getTagsByRecord("+recordId+") DOCTYPE:"+_.docType);
          var return_val = [];
          return privateClient.getObject('reverse/'+_.docType+'/'+recordId).
            then(function (obj) {
              if (typeof obj === "object") {
                return_val = obj;
              }
              return return_val;
            });
        };

        /**
         * get list of record IDs for this docType which have the tag specified.
         * @param {string} tagName - the name of the tag
         * @returns {array}
         */
        pub.getTagged = function(tagName) {
          //console.log('TAGS: getTagged('+tagName+'/'+_.docType+')');
          return privateClient.getObject('names/'+tagName+'/'+_.docType).
            then(function(obj) {
              var return_val = [];
              if (typeof obj === "object") {
                return_val = obj;
              }
              return return_val;
            });
        };

        /**
         * add to a list of record IDs to a tag.
         * @param {string}  tagName   - tag name
         * @param {array}   recordIds - list of record IDs
         * @oaran {boolean} doReverse - do reverse mapping for each tag
         */
        pub.addTagged = function(tagName, recordIds, doReverse) {
          if (doReverse === undefined) {
            doReverse = true;
          }
          //console.log('TAGS: addTagged('+tagName+'/'+_.docType+'):',recordIds);
          recordIds = _.ensureArray(recordIds);

          tagName = tagName.replace(/\s+$/g, ''); // no whitespace at end of string
          tagName = tagName.replace(/^\s+/g, ''); // or beginning
          return privateClient.getObject('names/'+tagName+'/'+_.docType).then(function (result) {
            var existingIds = _.ensureArray(result);
            var unique_obj = _.mergeAndUnique(recordIds, existingIds);
            console.log('ADD_TAGGED: '+tagName);

            if (doReverse) {
              // add ids to tags reverse lookup document
              return _.addReverse(tagName, recordIds).then(function() {
                return privateClient.storeObject('tag', 'names/'+tagName+'/'+_.docType, unique_obj);
              });
            } else {
                return privateClient.storeObject('tag', 'names/'+tagName+'/'+_.docType, unique_obj);
            }
          });
        };

        /**
         * adds a list of tags to an id
         * @params {string} recordId - record ID
         * @params {array}  tagNames -list og tag names
         */
        pub.addTagsToRecord = function(recordId, tagNames) {
          //console.log('TAGS: addTagsToRecord: ', tagNames);
          return asyncEach(_.ensureArray(tagNames), function(tagName) {
            console.log("ADDING: "+tagName+' rid:'+recordId);
            return pub.addTagged(tagName, recordId, false);
          }).then(function() {
              return _.addReverse(tagNames, recordId);
          });
        };

        /**
         * sets a list of tags for an id, overwriting the old ones
         * @params {string} recordId - record ID
         * @params {array}  tagNames -list og tag names
         */
        pub.updateTagsForRecord = function(recordId, tagNames) {
          //console.log('TAGS: addTagsToRecord: ', tagNames);
          return pub.removeRecord(recordId).
            then(curry(pub.addTagsToRecord, recordId, tagNames));
        };

        /**
         * removes an ID from a specified tag
         * @param {string} tag name
         * @param {array|string} id(s) of record to remove from list
         */
        pub.removeTagged = function(tagName, recordIds) {
          //console.log('TAGS: removeTagged('+tagName+', '+recordIds+')');
          recordIds = _.ensureArray(recordIds);

          // get object for this tag
          return pub.getTagged(tagName).
            then(function(existingIds) {

              // remove all occurences of appId(s) from existingIds list
              var num_recordIds = recordIds.length;
              for (var i = 0; i < num_recordIds; i++) {
                var num_existingIds = existingIds.length;
                for (var j = 0; j < num_existingIds; j++) {
                  if (recordIds[i] === existingIds[j]) {
                    existingIds.splice(j, 1);
                    break;
                  }
                }
              }
              return _.removeTagFromReverse(recordIds, tagName).
                then(function() {
                  if (existingIds.length === 0) {
                    return privateClient.remove('names/'+tagName+'/'+_.docType);
                  } else {
                    return privateClient.storeObject('tag', 'names/'+tagName+'/'+_.docType, existingIds);
                  }
                });
            });
        };

        /**
         * remove the specified record ID from all tags
         * @params {string} recordId - record ID
         */
        pub.removeRecord = function(recordId) {
          //console.log('TAGS: removeRecord()');
          return pub.getTagsByRecord(recordId).
            then(function(tagList) {
              return asyncEach(tagList, function(tag) {
                return pub.removeTagged(tag, recordId);
              });
            });
        };

        /**
         * removes a tagName from the reverse lookup for the specified IDs
         * @params {array|string} recordIds - id(s) of record(s)
         * @params {string}       tagName  - tag name(s)
         */
        _.removeTagFromReverse = function(recordIds, tagName) {
          //console.log('TAG: _removeTagFromReverse('+recordIds+', '+tagName+')');
          recordIds = _.ensureArray(recordIds);

          return asyncEach(recordIds, function(recordId) {
            return pub.getTagsByRecord(recordId).
              then(function(existingTags) {
                var num_existingTags = existingTags.length;
                var updatedTags = [];
                for (var j = 0; j < num_existingTags; j++) {
                  if (existingTags[j] === tagName) {
                    continue;
                  } else {
                    updatedTags.push(existingTags[j]);
                  }
                }

                if (updatedTags.length === 0) {
                  return privateClient.remove('reverse/'+_.docType+'/'+recordId);
                } else {
                  return privateClient.storeObject('tag', 'reverse/'+_.docType+'/'+recordId, updatedTags);
                }
              });
          }).then(function(results, errors) {
            if(errors.length > 0) {
              throw "ERRORS: " + errors.join(', ');
            }
            return results;
          });
        };

        /**
         * add tags to record ids in the reverse lookup documents
         * @param {array}   tagNames  - tag names
         * @param {array}   recordIds - list of record ids
         */
        _.addReverse = function(tagNames, recordIds) {
          //console.log('TAG: _addReverse() called', tagNames, recordIds);
          tagNames = _.ensureArray(tagNames);
          recordIds = _.ensureArray(recordIds);

          return asyncEach(recordIds, function(recordId) {
            return privateClient.getObject('reverse/'+_.docType+'/'+recordId).
              then(function(existingTags) {
                if(! existingTags) {
                  existingTags = [];
                }
                var uniqueTagNames = _.mergeAndUnique(existingTags, tagNames);
                //console.log('STORING: reverse/'+_.docType+'/'+recordIds[i], uniqueTagNames);
                return privateClient.storeObject('reverse', 'reverse/'+_.docType+'/'+recordId, uniqueTagNames);
              });
          }).then(function(results, errors) {
            if(errors.length > 0) {
              throw "ERRORS: " + errors.join(', ');
            }
            return results;
          });
        };

        /**
         * merge two arrays and ensure only unique entries
         * @param {array} obj1
         * @param {array} obj2
         * @return {array} merged and unique array
         */
        _.mergeAndUnique = function(obj1, obj2) {
          // merge new tags in with existing
          //console.log('MAU obj1: '+obj1.concat);
          //console.log('MAU obj2: '+obj2.concat);
          var new_obj = obj1.concat(obj2).sort();

          // unique entries only, filter out dupes
          var num_new_obj = new_obj.length;
          var unique_obj = [];
          for(var i=0; i < num_new_obj; ++i) {
            if (new_obj[i] !== new_obj[i+1]) {
              unique_obj.push(new_obj[i]);
            }
          }
          return unique_obj;
        };

        /**
         * ensures the passed value is an array, makes it one if it's a string
         * @param  {array|string} recordIds   - string or array of recordIds
         * @return {array} array of record ids
         */
        _.ensureArray = function(vals) {
          if (typeof vals === 'string') {
            vals = [vals];
          } else if (vals === undefined) {
            vals = [];
          }
          return vals;
        };

        return pub;
      }

    }
  };
});
