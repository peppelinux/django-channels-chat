import logging

from django.contrib.auth import get_user_model
from django.db.models import (Model,
                              CharField,
                              TextField,
                              DateTimeField,
                              ForeignKey,
                              CASCADE)

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


logger = logging.getLogger(__name__)


class ChatMessageModel(Model):
    """
    This class represents a chat message. It has a owner (user), timestamp and
    the message body.

    """
    user = ForeignKey(get_user_model(), on_delete=CASCADE,
                      verbose_name='user',
                      related_name='from_user', db_index=True)
    recipient = ForeignKey(get_user_model(), on_delete=CASCADE,
                           verbose_name='recipient',
                           related_name='to_user', db_index=True)
    created = DateTimeField(auto_now_add=True,
                            editable=False,
                            db_index=True)
    read_date = DateTimeField(editable=False, null=True, blank=True)
    room = CharField(max_length=150, null=True, blank=True)
    body = TextField('body')

    def __str__(self):
        return str(self.id)

    def characters(self):
        """
        Toy function to count body characters.
        :return: body's char number
        """
        return len(self.body)

    def notify_ws_clients(self):
        """
        Inform client there is a new message.
        """
        notification = {
            'type': 'recieve_group_message',
            'message': '{}'.format(self.id)
        }

        channel_layer = get_channel_layer()
        logger.debug("user.id {}".format(self.user.id))
        logger.debug("user.id {}".format(self.recipient.id))

        async_to_sync(channel_layer.group_send)("{}".format(self.user.id), notification)
        async_to_sync(channel_layer.group_send)("{}".format(self.recipient.id), notification)

    def save(self, *args, **kwargs):
        """
        Trims white spaces, saves the message and notifies the recipient via WS
        if the message is new.
        """
        new = self.id
        self.body = self.body.strip()  # Trimming whitespaces from the body
        super(ChatMessageModel, self).save(*args, **kwargs)
        if new is None:
            self.notify_ws_clients()

    # Meta
    class Meta:
        app_label = 'chat'
        verbose_name = 'message'
        verbose_name_plural = 'messages'
        ordering = ('-created',)
