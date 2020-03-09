from django.contrib.auth import get_user_model
from asgiref.sync import async_to_sync
from channels.generic.websocket import WebsocketConsumer
import json
import logging

from . models import UserChannel
from . utils import chat_operator


logger = logging.getLogger(__name__)


class ChatConsumer(WebsocketConsumer):

    def _create_user_channel(self, user, channel_name, room):
        # purge old user channels in room
        UserChannel.objects.filter(user=user, room=self.room_name).delete()
        # create new
        UserChannel.objects.create(user=user,
                                   channel=self.channel_name,
                                   room=self.room_name)

    def connect(self):
        user_id = self.scope["session"]["_auth_user_id"]

        # only for logged users
        if not user_id:
            self.close()

        self.user = get_user_model().objects.get(pk=user_id)

        # self.group_name = "{}".format(user_id)
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.group_name = 'chat_{}'.format(self.room_name)

        # Join room group
        async_to_sync(self.channel_layer.group_add)(
            self.group_name,
            self.channel_name
        )

        self._create_user_channel(user=self.user,
                                  channel_name=self.channel_name,
                                  room=self.room_name)
        logger.info("{} connected to websocket".format(self.user))
        self.accept()

        # Send message to room group
        notification = {
            'type': 'join_room',
            'room': self.room_name,
            'user': self.user.username,
            'operator': chat_operator(self.user)
        }
        logger.info("connect notification: {}".format(notification))
        async_to_sync(self.channel_layer.group_send)(
            self.group_name,
            notification
        )

        active_users = UserChannel.objects.filter(room=self.room_name).exclude(user=self.user)
        for au in active_users:
            if(chat_operator(self.user)) or (chat_operator(au.user)):
                notification = {
                    'type': 'add_user',
                    'room': self.room_name,
                    'user': au.user.username,
                    'operator': chat_operator(au.user)
                }
                async_to_sync(self.channel_layer.send)(
                    self.channel_name,
                    notification
                )

    def disconnect(self, close_code):
        logger.info("disconnected from websocket")
        UserChannel.objects.filter(channel=self.channel_name,
                                   room=self.room_name).delete()
        user_id = self.scope["session"]["_auth_user_id"]
        user = get_user_model().objects.get(pk=user_id)

        # Send message to room group
        notification = {
            'type': 'leave_room',
            'room': self.room_name,
            'user': self.user.username
        }
        async_to_sync(self.channel_layer.group_send)(
            self.group_name,
            notification
        )

        # Leave room group
        async_to_sync(self.channel_layer.group_discard)(
            self.group_name,
            self.channel_name
        )

    # Join a room
    def join_room(self, event):
        user = get_user_model().objects.filter(username=event['user']).first()
        if chat_operator(self.user):
            self.send(
                text_data=json.dumps({
                    'command': 'join_room',
                    'room': event['room'],
                    'user': event['user'],
                    'operator': event['operator']
                })
            )
        elif user and event['user'] != self.user.username and chat_operator(user):
            self.send(
                text_data=json.dumps({
                    'command': 'join_room',
                    'room': event['room'],
                    'user': event['user'],
                    'operator': event['operator']
                })
            )

    # Leave a room
    def leave_room(self, event):
        self.send(
            text_data=json.dumps({
                'command': 'leave_room',
                'room': event['room'],
                'user': event['user']
            })
        )

    # Add user to room
    def add_user(self, event):
        self.send(
            text_data=json.dumps({
                'command': 'add_user',
                'room': event['room'],
                'user': event['user'],
                'operator': event['operator']
            })
        )

    # Receive one-to-one message from WebSocket
    def receive(self, event):
        message = event['message']
        logger.info(message)
        self.send(
            text_data=json.dumps({
                'message': message
            })
        )

    # Receive message in room
    def receive_group_message(self, event):
        # broadcast only for staff users
        message = event['message']
        # Send message to WebSocket
        self.send(
            text_data=json.dumps({
                'message': message,
            })
        )
