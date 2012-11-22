/*
 * Mailcheck https://github.com/Kicksend/mailcheck
 * Author
 * Derrick Ko (@derrickko)
 *
 * License
 * Copyright (c) 2012 Receivd, Inc.
 *
 * Licensed under the MIT License.
 *
 * v 1.1
 *
 * ------------------------------------
 * remoteStorage.js modifications:
 *
 * 2012-10-24:
 * - added AMD wrapper
 * - removed jQuery stuff
 * - replaced defaultDomains with our own version
 */

define([], function() {

  var Kicksend = {
    mailcheck : {
      threshold: 3,

      defaultDomains: ["5apps.com", "heahdk.net"],

      defaultTopLevelDomains: ["co.uk", "com", "net", "org", "info", "edu", "gov", "mil"],

      run: function(opts) {
        opts.domains = opts.domains || Kicksend.mailcheck.defaultDomains;
        opts.topLevelDomains = opts.topLevelDomains || Kicksend.mailcheck.defaultTopLevelDomains;
        opts.distanceFunction = opts.distanceFunction || Kicksend.sift3Distance;

        var result = Kicksend.mailcheck.suggest(encodeURI(opts.email), opts.domains, opts.topLevelDomains, opts.distanceFunction);

        if (result) {
          if (opts.suggested) {
            opts.suggested(result);
          }
        } else {
          if (opts.empty) {
            opts.empty();
          }
        }
      },

      suggest: function(email, domains, topLevelDomains, distanceFunction) {
        email = email.toLowerCase();

        var emailParts = this.splitEmail(email);

        var closestDomain = this.findClosestDomain(emailParts.domain, domains, distanceFunction);

        if (closestDomain) {
          if (closestDomain != emailParts.domain) {
            // The email address closely matches one of the supplied domains; return a suggestion
            return { address: emailParts.address, domain: closestDomain, full: emailParts.address + "@" + closestDomain };
          }
        } else {
          // The email address does not closely match one of the supplied domains
          var closestTopLevelDomain = this.findClosestDomain(emailParts.topLevelDomain, topLevelDomains);
          if (emailParts.domain && closestTopLevelDomain && closestTopLevelDomain != emailParts.topLevelDomain) {
            // The email address may have a mispelled top-level domain; return a suggestion
            var domain = emailParts.domain;
            closestDomain = domain.substring(0, domain.lastIndexOf(emailParts.topLevelDomain)) + closestTopLevelDomain;
            return { address: emailParts.address, domain: closestDomain, full: emailParts.address + "@" + closestDomain };
          }
        }
        /* The email address exactly matches one of the supplied domains, does not closely
         * match any domain and does not appear to simply have a mispelled top-level domain,
         * or is an invalid email address; do not return a suggestion.
         */
        return false;
      },

      findClosestDomain: function(domain, domains, distanceFunction) {
        var dist;
        var minDist = 99;
        var closestDomain = null;

        if (!domain || !domains) {
          return false;
        }
        if(!distanceFunction) {
          distanceFunction = this.sift3Distance;
        }

        var numDomains = domains.length;
        for (var i = 0; i < numDomains; i++) {
          if (domain === domains[i]) {
            return domain;
          }
          dist = distanceFunction(domain, domains[i]);
          if (dist < minDist) {
            minDist = dist;
            closestDomain = domains[i];
          }
        }

        if (minDist <= this.threshold && closestDomain !== null) {
          return closestDomain;
        } else {
          return false;
        }
      },

      sift3Distance: function(s1, s2) {
        // sift3: http://siderite.blogspot.com/2007/04/super-fast-and-accurate-string-distance.html
        if (s1 === null || s1.length === 0) {
          if (s2 === null || s2.length === 0) {
            return 0;
          } else {
            return s2.length;
          }
        }

        if (s2 === null || s2.length === 0) {
          return s1.length;
        }

        var s1Length = s1.length;
        var s2Length = s2.length;
        var c = 0;
        var offset1 = 0;
        var offset2 = 0;
        var lcs = 0;
        var maxOffset = 5;

        while ((c + offset1 < s1Length) && (c + offset2 < s2Length)) {
          if (s1.charAt(c + offset1) == s2.charAt(c + offset2)) {
            lcs++;
          } else {
            offset1 = 0;
            offset2 = 0;
            for (var i = 0; i < maxOffset; i++) {
              if ((c + i < s1Length) && (s1.charAt(c + i) == s2.charAt(c))) {
                offset1 = i;
                break;
              }
              if ((c + i < s2Length) && (s1.charAt(c) == s2.charAt(c + i))) {
                offset2 = i;
                break;
              }
            }
          }
          c++;
        }
        return (s1Length + s2Length) /2 - lcs;
      },

      splitEmail: function(email) {
        var parts = email.split('@');

        if (parts.length < 2) {
          return false;
        }

        var numParts = parts.length;
        for (var i = 0; i < numParts; i++) {
          if (parts[i] === '') {
            return false;
          }
        }

        var domain = parts.pop();
        var domainParts = domain.split('.');
        var tld = '';

        if (domainParts.length === 0) {
          // The address does not have a top-level domain
          return false;
        } else if (domainParts.length == 1) {
          // The address has only a top-level domain (valid under RFC)
          tld = domainParts[0];
        } else {
          // The address has a domain and a top-level domain
          var numDomainParts = domainParts.length;
          for (i = 1; i < numDomainParts; i++) {
            tld += domainParts[i] + '.';
          }
          if (numDomainParts >= 2) {
            tld = tld.substring(0, tld.length - 1);
          }
        }

        return {
          topLevelDomain: tld,
          domain: domain,
          address: parts.join('@')
        };
      }
    }
  };

  return Kicksend;
});
