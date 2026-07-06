from succulent.api import SucculentAPI

# The container's entrypoint runs `gunicorn -b 0.0.0.0:8080 -w N run:app`, which
# imports this module and looks for a WSGI-callable named `app` - it does NOT
# call api.start(). gunicorn binds its own listening socket from the `-b` flag
# and never reads SucculentAPI's `port` attribute, so the value below only
# matters for the standalone path.
#
# Standalone `python run.py` (outside Docker/gunicorn) calls api.start(), which
# runs Flask's own dev server on this exact port - 9090, the same port the
# frontend and simulate_data.py already call (http://localhost:9090), and
# distinct from the backend's own 8080 so the two servers don't collide when
# both run on the same machine.
api = SucculentAPI(host='0.0.0.0', port=9090, config='configuration.yml', format='csv')
app = api.app

if __name__ == '__main__':
    # Only used for standalone `python run.py` outside of gunicorn/Docker.
    api.start()
