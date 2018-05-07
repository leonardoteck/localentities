
var localEntities = new LocalEntities();

function LocalEntities() {
    'use strict';

    ////////////////////////// Declarações

        let isReady = false; // Indica se as informações do banco foram carregadas
        let entities = {}; // Lista com entidades registradas
        let lastIds = {}; // Últimas IDs registradas para cada entidade. Serve para ter uma ID nova para cada objeto adicionado
        let requests = []; // Alguns métodos públicos só podem ser executados depois que os dados do banco foram carregados
        let ledb_lastIds = {}; // Instância da tabela que armazena as últimas IDs
        let cache = {}; // Cache de todos os objetos que passaram por qualquer método

        this.isRegistered = isRegistered;
        this.register = register;
        this.get = get;
        this.set = set;
        this.remove = remove;
        this.setRange = setRange;
        this.getAll = getAll;
        this.clear = clear;
        this.refresh = refresh;
                
        activate();

    // ////////////////////////// Inicialização

        function activate() {
            ledb_lastIds = localforage.createInstance({
                name: 'LocalEntitiesDB',
                storeName: 'LastIds'
            });

            ledb_lastIds.iterate(function (value, key) {
                lastIds[key] = value;
            }, function () {
                isReady = true;
                while (requests.length > 0) {
                    let req = requests.shift();
                    req.fn(req.resolve, req.reject);
                }
            });
        }

    ////////////////////////// Funções públicas

        function isRegistered(constr) {
            return !!entities[constr.name];
        }

        function register(constr, mapping) {
            if (isRegistered(constr))
                return;
            let name = constr.name;
            entities[name] = (new Entity(name, constr, mapping));
        }

        function get(type, id, include) {
            return new Promise(function (resolve, reject) {
                function getInclude(entity, id, include, node, leafProp) {
                    getsLeft++;
                    entity.store.getItem(id.toString()).then(function (value) {
                        getsLeft--;
                        
                        if (!value) {
                            tryResolve();
                            return;
                        }

                        value = new entity.constr(value);

                        if (node && leafProp)
                            node[leafProp] = value;
                        
                        if (include.length == 0) {
                            tryResolve();
                            return;
                        }

                        let propToInclude = include.shift();
                        let propMap = entity.mapping[propToInclude];
                        
                        if (value[propMap.relationKey])
                            getInclude(entities[propMap.type], value[propMap.relationKey], include, value, propToInclude);
                        else
                            tryResolve();
                    }).catch(reject);
                }

                function tryResolve() {
                    if (getsLeft == 0)
                        resolve(rootOfRoots);
                }

                let rootOfRoots;
                let getsLeft = 0;
                let entity = entities[type];
                if (!entity)
                    reject(errFn('Entity not registered'));

                try {
                    if (!include)
                        include = [];
                    else if (typeof include === 'string')
                        include = [include];
                        
                    entity.store.getItem(id.toString()).then(function (value) {

                        rootOfRoots = new entity.constr(value);

                        if (include.length === 0)
                            resolve(rootOfRoots);
                        else {
                            include.forEach(function(inc) {
                                inc = inc.split('.');
                                let propToInclude = inc.shift();
                                let propMap = entity.mapping[propToInclude];

                                if (rootOfRoots[propMap.relationKey])
                                    getInclude(entities[propMap.type], rootOfRoots[propMap.relationKey], inc, rootOfRoots, propToInclude);
                            });
                            tryResolve();
                        }
                    });
                } catch (ex) {
                    reject(ex);
                }
            });
        }

        function getAll(type, include) {
            return new Promise(function (resolve, reject) {
                if (!isReady) {
                    getAllReqs.push({
                        type: type,
                        include: include,
                        resolve: resolve,
                        reject: reject
                    });
                }
                else
                    resolveGetAll(type, include, resolve, reject);

                try {
                    let res = [];
                    let entity = entities[type];
                    
                    entity.store.iterate(function(value, key, iterationNumber) {
                        res.push(value);
                    }).then(function () {
                        resolve(res);
                    }).catch(reject);
                } catch (ex) {
                    reject(ex);
                }
            });
        }
        
        function set(id, value) {
            let entity;
            if (id && typeof id == 'object' && !value) {
                value = id;
                entity = getEntity(value);
                id = value[entity.propId];
            } else
                entity = getEntity(value);

            prepare(id, value, entity);
        }

        function setRange(values) {
            if (!(values instanceof Array) || values.length == 0)
                return;
            let entity = getEntity(values[0]);
            values.forEach(function(value) {
                let id = value[entity.propId];
                prepare(id, value, entity);                
            });
        }

        function remove(type, id, include) {
            return new Promise(function (resolve, reject) {
                try {
                    let entity = entities[type];
                    
                    entity.store.removeItem(id.toString()).then(function() {
                        resolve();
                    }).catch(function(err) {
                        reject(err);
                    });
                } catch (ex) {
                    reject(ex);
                }
            });
        }

        function clear(type) {
            return new Promise(function (resolve, reject) {
                try {
                    entities[type].store.clear()
                        .then(resolve)
                        .catch(reject);
                } catch (ex) {
                    reject(ex);
                }
            });
        }

        function refresh(values) {
            if (!(values instanceof Array) || values.length == 0)
                return;
            let entity = getEntity(values[0]);
            entity.store.clear().then(function () {
                values.forEach(function(value) {
                    let id = value[entity.propId];
                    prepare(id, value, entity);                
                });
            });
        }

    ////////////////////////// Funções privadas

        ///////// Funções do Set

        function prepare(id, value, entity, idSup, valueSup) {
            let refValue = value;
            if (refValue instanceof Array)
                refValue = refValue[0];

            let idMap = entity.mapping[entity.propId]; // pega a o mapeamento da id
            let saveId = '';

            if (!id) {
                id = (++lastIds[entity.constr.name]) * -1; // id de adição é negativa pra não dar conflito
                saveId = entity.constr.name;
                value[entity.propId] = id;
            } else if (idMap.type == 'number' && // vê se é numérico
                Math.abs(id) > lastIds[entity.constr.name]) // e maior que a última id presente
                lastIds[entity.constr.name] = id;
            
            if (idSup && valueSup)
                valueSup[idSup] = id;
                
            if (value instanceof Array)
                for (let i = 0; i < value.length; i++)
                    separate(value[i], entity);
            else
                separate(value, entity);
            
            entity.store.setItem(id.toString(), value).then(function (v) {
                if (saveId)
                    ledb_lastIds.setItem(saveId, Math.abs(id));
            }).catch(errFn);
        }

        function separate(value, entity) {
            for (let j = 0; j < entity.relations.length; j++) {
                let relation = entity.relations[j];
                if (value[relation.relProp]) { // achou o obj. de relacionamento
                    prepare(value[relation.fkProp],
                        value[relation.relProp],
                        entities[entity.mapping[relation.relProp].type/*.replace('Array:', '')*/],
                        relation.fkProp,
                        value);
                    value[relation.relProp] = null;
                }
            }
        }

        function getEntity(value) {
            let refValue = value;
            if (refValue instanceof Array)
                refValue = refValue[0];

            if (typeof refValue !== 'object')
                throw new TypeError(errFn('Only objects or arrays of objects can be stored'));
            
            let constr = Object.getPrototypeOf(refValue).constructor;
            let entity = entities[constr.name];
            if (entity)
                return entity;                

            let count = {};
            for (let entName in entities)
                if (entities.hasOwnProperty(entName)) {
                    let ent = entities[entName];
                    count[entName] = 0;
                    for (let mapKey in ent.mapping)
                        if (ent.mapping.hasOwnProperty(mapKey))
                            for (let valueProp in value)
                                if (value.hasOwnProperty(valueProp) && valueProp == mapKey) {
                                    count[entName]++;
                                    break;
                                }
                }   
            
            let chosen = [];
            for (let key in count) {
                if (count.hasOwnProperty(key)) {
                    if (chosen.length == 0)
                        chosen.push({
                            key: key,
                            count: count[key]
                        });
                    else if (count[key] >= chosen[0].count) {
                        if (count[key] > chosen[0].count)
                            chosen.length = 0;
                        chosen.push({
                            key: key,
                            count: count[key]
                        });
                    }
                }
            }

            if (chosen.length > 1) {
                let one = chosen[0];
                chosen.forEach(function (ch) {
                    ch.count = Math.abs(ch.count - Object.getOwnPropertyNames(entities[ch.key].mapping).length);
                    if (ch.count < one.count)
                        one = ch;
                });
                chosen = [one];
            }
            if (chosen.length == 0)
                throw new TypeError(errFn('Entity not registered'));
            return entities[chosen[0].key];
        }

        ///////// Outras

        function tryExecute(fn, resolve, reject) {
            if (isReady)
                fn(resolve, reject);
            else
                requests.push({ fn: fn, resolve: resolve, reject: reject });
        }

        function errFn(msg) {
            return 'Error in localEntities: ' + msg;
        }
        
        class Entity {
            constructor(name, constr, mapping) {
                this.constr = constr;
                this.mapping = mapping;
                this.relations = [];
                for (let rel in mapping)
                    if (mapping.hasOwnProperty(rel) && mapping[rel].relationKey)
                        this.relations.push({
                            fkProp: mapping[rel].relationKey,
                            relProp: rel,
                            fk: mapping[mapping[rel].relationKey],
                            rel: mapping[rel]
                        });
                if (!lastIds[name])
                    lastIds[name] = 0;
                this.propId = Object.getOwnPropertyNames(this.mapping).find(function (prop) {
                    return mapping[prop].pk === true;
                });
                this.store = localforage.createInstance({
                    name: 'AppDB',
                    storeName: name
                });
            }
        }
}