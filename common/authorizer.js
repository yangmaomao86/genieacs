"use strict";

const validators = {
  pass: require("./validators/pass"),
  test: require("./validators/test")
};

class Authorizer {
  constructor(permissionSets) {
    this.permissionSets = permissionSets;
    this.validtorCache = new WeakMap();
    this.hasAccessCache = {};
  }

  hasAccess(resourceType, access) {
    const cacheKey = `${resourceType}-${access}`;
    if (cacheKey in this.hasAccessCache)
      return this.hasAccessCache[cacheKey];

    let has = false;
    for (const permissionSet of this.permissionSets) {
      for (const perm of permissionSet) {
        if (perm[resourceType]) {
          if (perm[resourceType].access >= access) {
            has = true;
            break;
          }
        }
      }
    }

    this.hasAccessCache[cacheKey] = has;
    return has;
  }

  getValidator(resourceType, resource) {
    if (this.validtorCache.has(resource))
      return this.validtorCache.get(resource);

    let funcs = {};

    for (let permissionSet of this.permissionSets)
      for (let perm of permissionSet)
        if (perm[resourceType]) {
          if (perm[resourceType].access >= 3) {
            if (perm[resourceType].validate)
              for (let [k, v] of Object.entries(perm[resourceType].validate))
                funcs[k] = v;
          } else {
            funcs = {};
          }
        }

    const validator = (mutationType, mutation, any) => {
      let valid = false;
      for (let [k, v] of Object.entries(funcs))
        if (v) {
          let res = validators[k](
            resourceType,
            resource,
            mutationType,
            mutation,
            any
          );

          if (res > 0) valid = true;
          else if (res < 0) return false;
        }

      return valid;
    };

    this.validtorCache.set(resource, validator);
    return validator;
  }
}

module.exports = Authorizer;
