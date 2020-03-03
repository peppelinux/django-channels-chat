from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404

from .models import ChatMessageModel
from rest_framework.serializers import ModelSerializer, CharField


class ChatMessageModelSerializer(ModelSerializer):
    user = CharField(source='user.username', read_only=True)
    recipient = CharField(source='recipient.username')

    def create(self, validated_data):
        user = self.context['request'].user
        recipient = get_object_or_404(
            get_user_model(),
            username=validated_data['recipient']['username'])
        msg = ChatMessageModel(recipient=recipient,
                               body=validated_data['body'],
                               user=user)
        msg.save()
        return msg

    class Meta:
        model = ChatMessageModel
        fields = ('id', 'user', 'recipient', 'timestamp', 'body')


class UserModelSerializer(ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ('username',)
