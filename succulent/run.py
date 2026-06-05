from succulent.api import SucculentAPI

api = SucculentAPI(host='0.0.0.0', port=9090, config='configuration.yml', format='csv')
api.start()
