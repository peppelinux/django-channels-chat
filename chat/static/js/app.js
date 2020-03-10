let currentRecipient = '';
let chatInput = $('#chat-input');
let chatButton = $('#btn-send');
let userList = $('#user-list');
let messageList = $('#messages');
let users = [];


function addUserDiv(user, bold=false) {
    // build HTML user element in list
    let userItem = `<div class="item">
                        <a user="${user}" class="list-group-item user"`;
    if (bold) userItem += ` style="font-weight: bold;"`;
    userItem += `>${user}</a>`;
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
            setCurrentRecipient(target.text(), room_name);
        }
    );

    // add delete click event
    $(userList).children('.item').last().children('.item_delete').first().on("click",
        function () {
            let user_to_remove = $(event.target).parent().children('.user').first().text();
            removeUserFromList(user_to_remove);
        }
    );
}

function drawMessage(message, from_bot=false) {
   if (from_bot) {
        var date = new Date();
        var position = 'left';
        var avatar = 'BOT';
        var msg_body = message;
    } else {
        var position = 'left';
        var date = new Date(message.created);
        if (message.user === currentUser) position = 'right';
        var avatar = message.user;
        var msg_body = message.body;
    }
    const messageItem = `
            <li class="message ${position}">
                <div class="avatar">${avatar}</div>
                    <div class="text_wrapper">
                        <div class="text">${msg_body}<br>
                            <span class="small">${date}</span>
                    </div>
                </div>
            </li>`;
    $(messageItem).appendTo('#messages');
}

function getConversation(recipient, room_name) {
    $.getJSON(`/api/v1/message/?target=${recipient}&room=${room_name}`, function (data) {
        messageList.children('.message').remove();
        for (let i = data['results'].length - 1; i >= 0; i--) {
            drawMessage(data['results'][i]);
        }
        $( "a.user:contains('"+ currentRecipient +"')" ).css( "font-weight", "normal" );
        messageList.animate({scrollTop: messageList.prop('scrollHeight')});
    });
}

function addUserInList(by_user, operator=false, bold=false) {
    console.log("addUserInList: " + by_user);
    console.log("currentrecipient: "+ currentRecipient);
    let founded = false
    userList.children('.item').each(function( index ) {
        let visible_name = $(this).children().first().text();
        console.log(visible_name);
        if (visible_name == by_user) {
            founded = true;
            return false;
        }
    });

    if (!founded) {
        addUserDiv(by_user, bold);
        if (by_user != currentUser) users.push(by_user);
        if (by_user == currentRecipient) {
            drawMessage("L'utente è rientrato nella chat", true);
            messageList.animate({scrollTop: messageList.prop('scrollHeight')});
            enableInput();
            $( "a.user:contains('"+ by_user +"')" ).addClass( "active" );
        }
    } else if (by_user != currentRecipient) {
        $( "a.user:contains('"+ by_user +"')" ).css( "font-weight", "bold" );
    }
}

function removeUserFromList(user) {
    console.log("removeUserFromList:" + user);
    $("a:contains("+ user +")").parent().remove();
    console.log(users);
    users.splice(user, 1);
    // if currentRecipient leaves the room, you can't write anymore
    if (user == currentRecipient){
        drawMessage("L'utente ha abbandonato la chat", true);
        messageList.animate({scrollTop: messageList.prop('scrollHeight')});
        disableInput();
    }
    //currentRecipient = null;
    console.log(users);
}

function getMessageById(message, room_name) {
    id = JSON.parse(message).message;
    let by_user = null;
    console.log("getMessageById: " + currentRecipient);
    // if message is for this user (avoid 404 error on api get)
    if (currentRecipient) {
        $.getJSON(`/api/v1/message/${id}/?room=${room_name}`, function (data) {
            if (data.user === currentRecipient ||
                (data.recipient === currentRecipient && data.user == currentUser)) {
                    enableInput();
                    $("a:contains("+ currentRecipient +")").addClass('active');
                    drawMessage(data);
                    messageList.animate({scrollTop: messageList.prop('scrollHeight')});
            }
            else {
                $( "a.user:contains('"+ data.user +"')" ).css( "font-weight", "bold" );
            }
        });
    }
    // a message from a user that isn't present in list
    else {
        $.getJSON(`/api/v1/message/${id}/?room=${room_name}`, function (data) {
            if(data.user != currentUser)
                addUserInList(data.user, false, true);
        });
    }

}

function sendMessage(recipient, room_name, body, broadcast=0) {
    $.post('/api/v1/message/', {
        recipient: recipient,
        room: room_name,
        body: body,
        broadcast: broadcast
    }).fail(function () {
        alert('Error! Check console!');
    });
}

function setCurrentRecipient(username, room_name) {
    currentRecipient = username;
    getConversation(currentRecipient, room_name);
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
        //'/ws/chat/' + room_name + '/')

    chatInput.keypress(function (e) {
        if (e.keyCode == 13)
            chatButton.click();
    });

    chatButton.click(function () {
        if (chatInput.val().length > 0) {
            // broadcast message to all users of room
            if (currentRecipient==currentUser) {
                for (let i=0; i<users.length; i++) {
                    sendMessage(users[i], room_name, chatInput.val(), 1);
                }
            } else {
                sendMessage(currentRecipient, room_name, chatInput.val());
            }
            //sendMessage(currentRecipient, room_name, chatInput.val());
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
                    addUserInList(json_data['user'], json_data['operator']);
                    break;
                case 'leave_room':
                    console.log("received leave room: " + json_data['user']);
                    removeUserFromList(json_data['user']);
                    break;
                case 'add_user':
                    console.log("add user: " + json_data['user']);
                    addUserInList(json_data['user'], json_data['operator']);
                    break;
            }
        else if (json_data['message']) {
            console.log("message: " + e.data);
            getMessageById(e.data, room_name);
        }

    };
});
