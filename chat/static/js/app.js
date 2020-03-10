let currentRecipient = '';
let currentRecipient_fullname = '';
let chatInput = $('#chat-input');
let chatButton = $('#btn-send');
let userList = $('#user-list');
let messageList = $('#messages');
let users = [];


function addUserDiv(user, user_fullname, bold=false) {
    // build HTML user element in list
    let userItem = `<div class="item">
                        <a user="${user}" class="list-group-item user"`;
    if (bold) userItem += ` style="font-weight: bold;"`;
    if (user == currentUser) userItem += `><b>Room Broadcast Channel</b></a>`;
    else userItem += `>${user_fullname}</a>`;
    if (currentUser != user)
        userItem += `<span class="item_delete">[close]</span>`;
    userItem += `</div>`;

    $(userItem).appendTo(userList);

    // add click event
    $(userList).children('.item').last().children('.user').first().on("click",
        function () {
            let target = $(event.target)
            userList.children('.item').children('.active').removeClass('active');
            target.addClass('active');
            setCurrentRecipient(username=target.attr('user'),
                                full_name=target.text(),
                                room_name=room_name);
        }
    );

    // add delete click event
    $(userList).children('.item').last().children('.item_delete').first().on("click",
        function () {
            let user_to_remove = $(event.target).parent().children('.user').first().attr('user');
            removeUserFromList(user=user_to_remove,
                               manual_remove=true);
        }
    );
}

function drawMessage(message, user_fullname, from_bot=false) {
    console.log("drawMessage " + message);
    var avatar = currentRecipient_fullname;
    if (user_fullname) avatar = user_fullname;
    if (message.user === currentUser) avatar = 'io';
    var position = 'left';
    if (from_bot) {
        var date = new Date();
        var msg_body = message;
    } else {
        var date = new Date(message.created);
        if (message.user === currentUser) position = 'right';
        var msg_body = message.body;
    }
    const messageItem = `
            <li class="message ${position}">
                <div class="avatar">
                    <span>${avatar}</span>
                </div>
                <div class="text_wrapper">
                    <div class="text">${msg_body}<br>
                        <span class="small">${date}</span>
                    </div>
                </div>
            </li>`;
    $(messageItem).appendTo('#messages');
}

function getConversation(recipient, room_name) {
    console.log("getConversation " + recipient);
    $.getJSON(`/api/v1/message/?target=${recipient}&room=${room_name}`, function (data) {
        messageList.children('.message').remove();
        for (let i = data['results'].length - 1; i >= 0; i--) {
            console.log("getConversation " + data['results'][i]);
            drawMessage(message=data['results'][i]);
        }
        $( "a.user[user='" + currentRecipient + "']" ).css( "font-weight", "normal" );
        messageList.animate({scrollTop: messageList.prop('scrollHeight')});
    });
}

function addUserInList(user, user_fullname, bold=false, block_bot=false) {
    console.log("addUserInList: " + user);
    console.log("currentrecipient: "+ currentRecipient);
    let founded = false
    userList.children('.item').each(function( index ) {
        let visible_name = $(this).children().first().attr('user');
        console.log(visible_name);
        if (visible_name == user) {
            founded = true;
            return false;
        }
    });

    if (!founded) {
        addUserDiv(user=user,
                   user_fullname=user_fullname,
                   bold=bold);
        if (user != currentUser) users.push(user);
        if (user == currentRecipient) {
            if(!block_bot)
                drawMessage(message="L'utente è rientrato nella chat",
                            user_fullname='BOT',
                            from_bot=true);
            messageList.animate({scrollTop: messageList.prop('scrollHeight')});
            enableInput();
            $( "a.user[user='"+ user +"']" ).addClass( "active" );
        }
    } else if (user != currentRecipient) {
        $( "a.user[user='"+ user +"']" ).css( "font-weight", "bold" );
    }
}

function removeUserFromList(user, manual_remove=false) {
    console.log("removeUserFromList:" + user);
    $("a.user[user='"+ user +"']").parent().remove();
    console.log(users);
    users.splice(user, 1);
    // if currentRecipient leaves the room, you can't write anymore
    if (user == currentRecipient){
        if (!manual_remove) {
            drawMessage(message="L'utente ha abbandonato la chat",
                        user_fullname='BOT',
                        from_bot=true);
            messageList.animate({scrollTop: messageList.prop('scrollHeight')});
        }
        disableInput();
    }
    //currentRecipient = null;
    console.log(users);
}

function getMessageById(message, room_name) {
    id = JSON.parse(message).message;
    user_fullname = JSON.parse(message).user_fullname;
    let by_user = null;
    console.log("getMessageById: " + currentRecipient);

    // if message is for this user (avoid 404 error on api get)
    if (currentRecipient) {
        $.getJSON(`/api/v1/message/${id}/?room=${room_name}`, function (data) {
            if (data.user === currentRecipient ||
                (data.recipient === currentRecipient && data.user == currentUser)) {
                    enableInput();
                    $("a.user[user='"+ currentRecipient +"']").addClass('active');
                    drawMessage(message=data,
                                user_fullname=user_fullname);
                    messageList.animate({scrollTop: messageList.prop('scrollHeight')});
            }
            else {
                $( "a.user[user='"+ data.user +"']" ).css( "font-weight", "bold" );
            }
            let bold = false;
            if (data.user != currentRecipient) bold = true;
            if (data.user != currentUser)
                addUserInList(user=data.user,
                              user_fullname=user_fullname,
                              bold=bold,
                              block_bot=true);
        });
    }
    // a message from a user that isn't present in list
    else {
        $.getJSON(`/api/v1/message/${id}/?room=${room_name}`, function (data) {
            if(data.user != currentUser)
                addUserInList(user=data.user,
                              user_fullname=user_fullname,
                              bold=true);
        });
    }
}

function sendMessage(recipient, room_name, body, broadcast=0) {
    console.log("sendMessage / broadcast " + broadcast);
    $.post('/api/v1/message/', {
        recipient: recipient,
        room: room_name,
        body: body,
        broadcast: broadcast
    }).fail(function () {
        alert('Error! Check console!');
    });
}

function setCurrentRecipient(username, full_name, room_name) {
    currentRecipient = username;
    currentRecipient_fullname = full_name;
    getConversation(recipient=currentRecipient, room_name=room_name);
    enableInput();
}

function enableInput() {
    chatInput.prop('disabled', false);
    chatButton.prop('disabled', false);
    chatInput.focus();
}

function disableInput() {
    chatInput.prop('disabled', true);
    chatButton.prop('disabled', true);
}

$(document).ready(function () {
    //updateUserList(room_name);
    disableInput();
    var socket = new WebSocket(
        'ws://' + window.location.host +
        '/ws/chat/' + room_name + '/?session_key=${sessionKey}')

    chatInput.keypress(function (e) {
        if (e.keyCode == 13)
            chatButton.click();
    });

    chatButton.click(function () {
        if (chatInput.val().length > 0) {
            // broadcast message to all users of room
            if (currentRecipient==currentUser) {
                for (let i=0; i<users.length; i++) {
                    sendMessage(recipient=users[i],
                                room_name=room_name,
                                body=chatInput.val(),
                                broadcast=1);
                }
            } else {
                sendMessage(recipient=currentRecipient,
                            room_name=room_name,
                            body=chatInput.val());
            }
            chatInput.val('');
        }
    });

    socket.onmessage = function (e) {
        json_data = JSON.parse(e.data)
        console.log("socket.onmessage: " + json_data);
        if (json_data['command'])
            switch (json_data['command']) {
                case 'join_room':
                    console.log("received join room: " + json_data['user']);
                    console.log(json_data);
                    addUserInList(user=json_data['user'],
                                  user_fullname=json_data['user_fullname']);
                    break;
                case 'leave_room':
                    console.log("received leave room: " + json_data['user']);
                    removeUserFromList(user=json_data['user']);
                    break;
                case 'add_user':
                    console.log("add user: " + json_data['user']);
                    addUserInList(user=json_data['user'],
                                  user_fullname=json_data['user_fullname']);
                    break;
            }
        else if (json_data['message']) {
            console.log("message: " + e.data);
            getMessageById(message=e.data, room_name=room_name);
        }

    };
});
