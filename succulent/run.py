from succulent.api import SucculentAPI

# The container's entrypoint runs `gunicorn -b 0.0.0.0:8080 -w N run:app`, which
# imports this module and looks for a WSGI-callable named `app` - it does NOT
# call api.start(). SucculentAPI.start() calls Flask's own blocking dev server
# (app.run()), which was previously happening at import time on the wrong port
# (9090 instead of the 8080 gunicorn actually binds, per the 9090:8080 mapping
# in docker-compose.yml). With multiple gunicorn workers each importing this
# module, every worker independently tried to bind that same hardcoded port and
# crashed with "Address already in use" - so the container crash-looped forever
# and nothing was ever reachable on the port Docker actually forwards.
api = SucculentAPI(host='0.0.0.0', port=8080, config='configuration.yml', format='csv')
app = api.app

if __name__ == '__main__':
    # Only used for standalone `python run.py` outside of gunicorn/Docker.
    api.start()
