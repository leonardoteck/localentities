window.localEntities = new LocalEntities();

function LocalEntities() {
    "use strict";

    ////////////////////////// Declarações

        var instance = this;
        
        var isReady = false; // Indica se as informações do banco foram carregadas
        var entities = {}; // Lista com entidades registradas
        var lastIds = {}; // Últimas IDs registradas para cada entidade. Serve para ter uma ID nova para cada objeto adicionado
        var requests = []; // Alguns métodos públicos só podem ser executados depois que os dados do banco foram carregados
        var ledb_lastIds = {}; // Instância da tabela que armazena as últimas IDs
        var cache = {}; // Cache de todos os objetos que passaram por qualquer método

        instance.isRegistered = isRegistered;
        instance.register = register;
        instance.get = get;
        instance.set = set;
        instance.remove = remove;
        instance.setRange = setRange;
        instance.getAll = getAll;
        instance.clear = clear;
        instance.refresh = refresh;
                
        activate();

    ////////////////////////// Inicialização

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
                    var req = requests.shift();
                    req.fn(req.resolve, req.reject);
                }
            });
        }

    ////////////////////////// Funções públicas

        function isRegistered(constr) {
            return !!entities[constr.name];
        }

        function register(constr, mapping) {
            if (instance.isRegistered(constr))
                return;
            var name = constr.name;
            entities[name] = (new Entity(name, constr, mapping));
        }

        function get(type, id, include) {
            return new Promise(function (resolve, reject) {
                try {
                    var rootOfRoots;
                    var getsLeft = 0;
                    if (!include)
                        include = [];
                    else if (typeof include == 'string')
                        include = [include];
                        
                    var entity = entities[type];
                    entity.store.getItem(id.toString()).then(function (value) {

                        rootOfRoots = new entity.constr(value);

                        if (include.length == 0)
                            resolve(rootOfRoots);
                        else {
                            include.forEach(function(inc) {
                                inc = inc.split('.');
                                var propToInclude = inc.shift();
                                var propMap = entity.mapping[propToInclude];

                                if (rootOfRoots[propMap.relationKey])
                                    getInclude(entities[propMap.type], rootOfRoots[propMap.relationKey], inc, rootOfRoots, propToInclude);
                            });
                            tryResolve();
                        }
                    });

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

                            var propToInclude = include.shift();
                            var propMap = entity.mapping[propToInclude];
                            
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
                    var res = [];
                    var entity = entities[type];
                    
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
            var entity;
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
            var entity = getEntity(values[0]);
            values.forEach(function(value) {
                var id = value[entity.propId];
                prepare(id, value, entity);                
            });
        }

        function remove(type, id, include) {
            return new Promise(function (resolve, reject) {
                try {
                    var entity = entities[type];
                    
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
            var entity = getEntity(values[0]);
            entity.store.clear().then(function () {
                values.forEach(function(value) {
                    var id = value[entity.propId];
                    prepare(id, value, entity);                
                });
            });
        }

    ////////////////////////// Funções privadas

        ///////// Funções do Set

        function prepare(id, value, entity, idSup, valueSup) {
            var refValue = value;
            if (refValue instanceof Array)
                refValue = refValue[0];

            var idMap = entity.mapping[entity.propId]; // pega a o mapeamento da id
            var saveId = '';

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
                for (var i = 0; i < value.length; i++)
                    separate(value[i], entity);
            else
                separate(value, entity);
            
            entity.store.setItem(id.toString(), value).then(function (v) {
                if (saveId)
                    ledb_lastIds.setItem(saveId, Math.abs(id));
            }).catch(errFn);
        }

        function separate(value, entity) {
            for (var j = 0; j < entity.relations.length; j++) {
                var relation = entity.relations[j];
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
            var refValue = value;
            if (refValue instanceof Array)
                refValue = refValue[0];
            
            var constr = Object.getPrototypeOf(refValue).constructor;
            var entity = entities[constr.name];
            if (entity)
                return entity;                

            var count = {};
            for (var entName in entities)
                if (entities.hasOwnProperty(entName)) {
                    var ent = entities[entName];
                    count[entName] = 0;
                    for (var mapKey in ent.mapping)
                        if (ent.mapping.hasOwnProperty(mapKey))
                            for (var valueProp in value)
                                if (value.hasOwnProperty(valueProp) && valueProp == mapKey) {
                                    count[entName]++;
                                    break;
                                }
                }   
            
            var chosen = [];
            for (var key in count) {
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
                var one = chosen[0];
                chosen.forEach(function (ch) {
                    ch.count = Math.abs(ch.count - Object.getOwnPropertyNames(entities[ch.key].mapping).length);
                    if (ch.count < one.count)
                        one = ch;
                });
                chosen = [one];
            }
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
            alert('Error in localEntities: ' + msg);
        }
        
        function Entity(name, constr, mapping) {
            this.constr = constr;
            this.mapping = mapping;
            
            this.relations = [];
            for (var rel in mapping)
                if (mapping.hasOwnProperty(rel) && mapping[rel].relationKey)
                    this.relations.push({
                        fkProp: mapping[rel].relationKey,
                        relProp: rel,
                        fk: mapping[mapping[rel].relationKey],
                        rel: mapping[rel]
                    });

            
            if (!lastIds[name])
                lastIds[name] = 0;
            
            this.propId = Object.getOwnPropertyNames(this.mapping).find(function (prop) { // pega o nome da prop pk
                return mapping[prop].pk === true;
            });
            
            this.store = localforage.createInstance({
                name: 'AppDB',
                storeName: name
            });
        }
}