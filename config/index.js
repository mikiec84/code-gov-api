const cfenv = require('cfenv');
const path = require('path');
const dotenv = require('dotenv');
const jsonfile = require('jsonfile');

/**
 * Get the Elasticsearch service URL. Defaults to `http://localhost:9200`
 * @param {object} cloudFoundryEnv - Cloud Foundry app environment object.
 * @returns {string} - The Elasticsearch service URL
 */
function getElasticsearchUri(cloudFoundryEnv) {
  if(!cloudFoundryEnv.isLocal){
    const serviceName = process.env.ELASTICSEARCH_SERVICE_NAME
      ? process.env.ELASTICSEARCH_SERVICE_NAME
      : 'code_gov_elasticsearch';

    const elasticSearchCredentials = cloudFoundryEnv.getServiceCreds(serviceName);

    return elasticSearchCredentials.uri
      ? elasticSearchCredentials.uri
      : 'http://localhost:9200';
  }
  return process.env.ES_URI ? process.env.ES_URI : 'http://localhost:9200';
}

/**
 * Gets the configured application port. Defaults to 3000
 * @param {object} cloudFoundryEnv - Cloud Foundry app environment object.
 * @returns (integer) - The application port.
 */
function getPort(cloudFoundryEnv={}) {
  return process.env.PORT
    ? process.env.PORT
    : cloudFoundryEnv.port
      ? cloudFoundryEnv.port
      : 3000;
}

/**
 * Get the necessary application directories.
 * @returns {object} - Directory paths needed by the application
 */
function getAppFilesDirectories() {
  let filePath;

  if(process.env.GET_REMOTE_METADATA && process.env.REMOTE_METADATA_LOCATION) {
    filePath = process.env.REMOTE_METADATA_LOCATION;
  } else {
    filePath = process.env.NODE_ENV === 'testing'
      ? path.join(path.dirname(__dirname), 'config/testing_agency_metadata.json')
      : path.join(path.dirname(__dirname), 'config/agency_metadata.json');
  }

  return {
    AGENCY_ENDPOINTS_FILE: filePath
  };
}

/**
 * Get the Swagger docs configuration for the current environment.
 * @param {boolean} isProd - Boolean flag indicating if it is a production environment
 * @param {string} apiUrl - The configured Code.gov API URL
 * @returns {object} - Swagger configuration object
 */
function getSwaggerConf(isProd, apiUrl) {
  const SWAGGER_DOCUMENT = isProd
    ? jsonfile.readFileSync(path.join(path.dirname(__dirname), './swagger-prod.json'))
    : jsonfile.readFileSync(path.join(path.dirname(__dirname), './swagger.json'));

  SWAGGER_DOCUMENT.host = apiUrl ? apiUrl : 'api.code.gov';
  return SWAGGER_DOCUMENT;
}

/**
 * Get the application configuration for the supplied environment
 * @param {string} env - The application environment. This will default to a development environment
 * @returns {object} - object with all the configuration needed for the environment
 */
function getConfig(env='development') {
  let config = {
    prod_envs: ['prod', 'production']
  };

  const cloudFoundryEnv = cfenv.getAppEnv();

  config.isProd = config.prod_envs.includes(env);

  if(cloudFoundryEnv.isLocal) {
    dotenv.config(path.join(path.dirname(__dirname), '.env'));
  }

  config.LOGGER_LEVEL = process.env.LOGGER_LEVEL
    ? process.env.LOGGER_LEVEL
    : config.isProd
      ? 'INFO'
      : 'DEBUG';

  config.TERM_TYPES_TO_SEARCH = [
    "name",
    "agency.name",
    "agency.acronym",
    "tags",
    "languages"];
  config.VALID_QUERY_PARAMS = [
    'license',
    'name',
    'agency.name',
    'permissions.usageType',
    'agency.acronym',
    'status',
    'vcs',
    'measurementType.method',
    'language',
    'created',
    'lastModified',
    'metadataLastUpdated'
  ];
  config.UPDATE_REPO_REGEX = /(1\.0)(\.\d)?/;
  config.USE_HSTS = process.env.USE_HSTS ? process.env.USE_HSTS === 'true' : config.isProd;
  config.HSTS_MAX_AGE = process.env.HSTS_MAX_AGE ? parseInt(process.env.HSTS_MAX_AGE) : 31536000;
  config.HSTS_PRELOAD = process.env.HSTS_PRELOAD && process.env.HSTS_PRELOAD === 'true';
  config.HSTS_SUBDOMAINS = process.env.HSTS_SUBDOMAINS && process.env.HSTS_SUBDOMAINS === 'true';
  config.PORT = getPort(cloudFoundryEnv);

  config.GET_REMOTE_METADATA = process.env.GET_REMOTE_METADATA && process.env.GET_REMOTE_METADATA === 'true';
  config.ES_HOST = getElasticsearchUri(cloudFoundryEnv);

  Object.assign(config, getAppFilesDirectories());
  const apiUrl = process.env.API_URL
    ? process.env.API_URL
    : cloudFoundryEnv.app.uris
      ? `${cloudFoundryEnv.app.uris[0]}/api`
      : `0.0.0.0:${config.PORT}`;
  config.SWAGGER_DOCUMENT = getSwaggerConf(config.isProd, apiUrl);

  config.ALLOWED_DOMAINS = [
    `http://localhost:${config.PORT}`,
    `http://127.0.0.1:${config.PORT}`
  ];

  config.ALLOWED_DOMAINS.push(config.isProd ? 'https://api.data.gov' : '*');

  return config;
}

module.exports = getConfig;
