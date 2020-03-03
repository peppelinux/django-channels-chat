from . consumers import ChatConsumer

from django.conf.urls import url

websocket_urlpatterns = [
    url(r'^ws$', ChatConsumer),
]
