var chatParent = null;
var chatBody = null;
var chatFooter = null;
var profileBlade = null;
var profileConnections = null;
var strFollowers = "Followers";
var strFollowing = "Following";
var profileMentions = null;
var profileSubscriptions = null;
var profileBlockedUsers = null;
var updateProfileUrl = '/Profile/UpdateCombinedProfile';

var profile = null;
var avatar = null;
var editSelector = "";
var kendoSpinner = null;

// Social network dropdown options
var options = [
    { value: 'fa fa-twitter', 
      type: 'url', text: 'Twitter', placeholder: "Your Username", url: "https://twitter.com/", user: "" },
    { value: 'stocktwits-icon', 
      type: 'url', text: 'StockTwits', placeholder: "Your Username", url: "https://stocktwits.com/", user: "" },
    { value: 'fa fa-facebook-official', 
      type: 'url', text: 'Facebook', placeholder: "Your Username", url: "https://www.facebook.com/", user: "" },
    { value: 'fa fa-instagram', 
      type: 'url', text: 'Instagram', placeholder: "Your Username", url: "https://www.instagram.com/", user: "" },
    { value: 'fa fa-youtube-play', 
      type: 'url', text: 'YouTube', placeholder: "Your Username", url: "https://www.youtube.com/channel/", user: "" },
    { value: 'fa fa-envelope-o', 
      type: 'email', text: 'Email', placeholder: "Email Address", email: "" }
];

var kendoDropDowns = [];

// Generic variables used in more places than just the editprofile modal
var emailValid = false;
var keywords = [];
var screenNameValid = false;

$(document).ready(function () {
    $('#invalidEmailAddress').hide();

    $.getJSON("../Content/data/professionalKeywords.json", function (json) {
        keywords = json.keywords;
    });

    $('.chat-controls .img-avatar, .chat-controls .text-avatar, .chat-controls .text-avatar b').on('click mouseover', function (e) {
        if ($('.hover-box').is(':visible') && e.type == 'click')
            $('.hover-box').hide();
        else
            $('.hover-box').show();

        e.stopPropagation();
    })

    $('.chat-controls .hover-box, #main').on('click', function (e) {
        $('.hover-box').hide();
        e.stopPropagation();
    });

    if ($('#chatContainer').length > 0) {
        kendoSpinner = createKendoLoader($('#editSpinner'));
        chatParent = $('#chatContainer .panel.modal-container')
        chatBody = $('#chatContainer .panel-body.chat-body');
        profileBlade = $("#profileBlade");
        profileConnections = $("#profileConnections");
        profileMentions = $("#profileMentions");
        profileSubscriptions = $("#profileSubscriptions");
        profileBlockedUsers = $("#profileBlockedUsers");
        getProfile();

        $('#editProfile_Description').on('input', function () {
            this.style.height = "";
            this.style.height = Math.min(this.scrollHeight, 300) + "px";
        });

        $('#editProfileModal').on('change', updateAllowed);
        $('#editProfileModal ul').on('change', updateAllowed);
    }
});


function getProfile(callback) {
    var url = `/Profile/GetUserProfile`;

    $.ajax({
        url: url,
        type: "GET",
        success: function (data) {
            profile = data;
            data.SocialNetworks = JSON.parse(data.SocialNetworks);
        },
        fail: function (e) {
            console.error(e);
        },
        complete: function () {
            if (typeof callback == 'function')
                callback();

            createAvatar();
            bindProfileData();
        }
    });
}

function updateProfile() {
    $('#editProfileModal button.btn.current-menu-item').prop('disabled', true);
    $('#editSpinner').show();
    editSelector = "#editProfile_";

    profile.FirstName = $(`${editSelector}FirstName`).val();
    profile.LastName = $(`${editSelector}LastName`).val();
    profile.Email = $(`${editSelector}Email`).val();
    profile.ScreenName = $(`${editSelector}ScreenName`).val();
    profile.Description = $(`${editSelector}Description`).val();

    var socialNetworksJsonObject = [];

    var socialNetworks = $(`${editSelector}SocialNetworks > li`);
    for (var socialNetworkPlatform = 0; socialNetworkPlatform < socialNetworks.length; socialNetworkPlatform++) {

        var selectedPlatform = profile.SocialNetworks[socialNetworkPlatform].dropdown.data('kendoDropDownList').value();
        var socialMediaDropdownSelection = options.filter(socialMediaDropdownOption => socialMediaDropdownOption.value == selectedPlatform).map( el => el )[0];

        var socialPlatform = {
            placeholder: socialMediaDropdownSelection.placeholder,
            type: socialMediaDropdownSelection.type, 
            value: selectedPlatform
        }

        if (socialMediaDropdownSelection.url) {
            socialPlatform.url = socialMediaDropdownSelection.url;
            socialPlatform.user = socialNetworks[socialNetworkPlatform].children[3].value;
        }
        else 
            socialPlatform.email = socialNetworks[socialNetworkPlatform].children[3].value;

        socialNetworksJsonObject.push(socialPlatform);
    }

    var socialNetworksBackup = profile.SocialNetworks;

    profile.SocialNetworks = JSON.stringify(socialNetworksJsonObject);

    $.ajax({
        url: updateProfileUrl,
        type: "POST",
        contentType: 'application/json',
        data: JSON.stringify(profile),
        retryLimit: 2,
        success: function (data) {
            updateProfileSuccess();
        },
        fail: function (e) {
            profile.SocialNetworks = socialNetworksBackup;
            updateProfileFailOrError();
        },
        error: function () {
            profile.SocialNetworks = socialNetworksBackup;
            updateProfileFailOrError();
        }
    });
}

function updateProfileSuccess() {
    $('#editSpinner').hide();
    $('#updateProfileMsg').show();
    $('#updateProfileMsg').css('color', '#6ED25A');
    $('#updateProfileMsg').prop('innerText', 'Update succeeded!');
    setTimeout(function () {
        $('#editProfileModal').data('kendoWindow').close();
        $('#updateProfileMsg').prop('innerText', '');
        $('#updateProfileMsg').show();
        $('#editProfileModal button.btn.current-menu-item').prop('disabled', false);
        getProfile();
        profileUpdated++;
        chatHubDocumentReady(false);
    }, 3000);
}

function updateProfileFailOrError() {
    $('#editSpinner').hide();
    $('#updateProfileMsg').show();
    $('#updateProfileMsg').css('color', '#d25a5a');
    $('#updateProfileMsg').prop('innerText', 'Updating the profile failed');
    setTimeout(function () {
        $('#editProfileModal').data('kendoWindow').close();
        $('#updateProfileMsg').prop('innerText', '');
        $('#updateProfileMsg').val('');
        $('#updateProfileMsg').show();
        $('#editProfileModal button.btn.current-menu-item').prop('disabled', false);
    }, 3000);
}

function createAvatar() {
    var failedLoad = function () {
        var textAv = $('.text-avatar');
        textAv.removeClass('avatar-loading');

        textAv.children('b').addClass('fa fa-user');
        textAv.css('background', 'rgb(80 147 71)');
    }

    if (!profile) {
        failedLoad();
        return;
    }

    try {
        if (!window.localStorage.userAvatar) {
            var textAv = $('.text-avatar');
            textAv.removeClass('avatar-loading');
            if (textAv.children('b').hasClass('fa'))
                textAv.children('b').removeClass('fa fa-user');
            
            textAv.children('b').prop('innerText', profile.FirstName[0].toUpperCase());
            textAv.css('background', stringToColor(`${profile.FirstName}${profile.LastName}`));
            textAv.removeClass('hidden');
        }
        else {
	        $('.text-avatar').addClass('hidden');
            $('.img-avatar').prop('src', window.localStorage.userAvatar);
            $('.img-avatar').removeClass('hidden');
        }
    }
    catch (e) { // If there is a problem grabbing the users profile, just show a generic icon
        failedLoad();
    }
}

function bindProfileData() {
    try {
        var selector = "#Profile_";
        editSelector = "#editProfile_"

        for (var key in profile) {
            if (Object.prototype.hasOwnProperty.call(profile, key)) {
                var s = `${selector}${key}`;
                var se = `${selector}edit_${key}`;

                switch (key) {
                case 'FirstName':
                    //$(`${selector}name`).prop('innerText', `${profile[key]} ${profile['LastName']}`);
                    $(`${selector}edit_Name`).prop('innerText', `${profile[key]} ${profile['LastName']}`);
                    $(`${editSelector}FirstName`).val(profile[key]);
                    break;
                case 'LastName':
                    $(`${editSelector}LastName`).val(profile[key]);
                    break;
                case 'Following':
                    //bindArrayData(s, profile[key]);
                    break;
                case 'Followers':
                    //bindArrayData(s, profile[key]);
                    break;
                case 'SubscribedChannels':
                    //bindArrayData(s, profile[key]);
                    break;
                case 'BlockedUsers':
                    //blockedUserCount(s);
                    break;
                case 'SocialNetworks':
                    bindSocialNetworks(s, profile[key]);
                    break;
                case 'Mentions':
                    //mentionsCount(s, profile[key]);
                    break;
                default:
                    //$(s).prop('innerText', profile[key]);
                    $(se).prop('innerText', profile[key]);
                    $(`${editSelector}${key}`).val(profile[key]);
                    break;
                }
            }
        }
    }
    catch(e) {
        console.error(e);
    }
}


function bindArrayData(selector, data) {
    var el = $(selector);

    el.children('.count').prop('innerText', data.length);
    
    var ul = el.children('ul');
    ul.children().remove();

    for (var i = 0; i < data.length; i++)
    {
        var li = document.createElement('li');
        li.innerText = data[i];

        ul.append(li);
    }
}

function bindSocialNetworks(selector, data) {
    if (!data) return;

    //var el = $(selector);
    var editEl = $('#editProfile_SocialNetworks');

    //el.children().remove();
    editEl.children().remove();

    // Hides message telling users to edit their profiles to add a social network if there are already social networks on the users profile
    // if (el.labels().css('display') !== 'none')
    //     el.labels().hide();
    
    for (var i = 0; i < data.length; i++) {
        var d = data[i];
        
        addSocialNetwork(d);
    }
}

function displayProfile() {
    getProfile();

    if (!chatBody.hasClass('hidden')) chatBody.addClass('hidden');

    //adding this here since not everything in chatcontainer has a footer and this fixes bad display issue
    chatFooter = $('#chatContainer .panel-footer.chat-footer');
    
    if (!chatFooter.hasClass('hidden')) chatFooter.addClass('hidden');

    if (profileBlade.parent()[0] != chatParent[0])
        chatParent.append(profileBlade);

    if (profileBlade.hasClass('hidden')) profileBlade.removeClass('hidden');
}

function displayChangePassword() {
	$('#ChangePasswordModal').data('kendoWindow').open();
}

function displayBbsSubscription() {
	$('#BbsSubscriptionModal').data('kendoWindow').open();
}

function displaySettings() {
    $("#settingsModal").data("kendoWindow").open();
    $("#settingsModal").removeClass("hide");
    $("#tradeStationActive").prop("checked", window.tradeStationActive ? "checked" : "");
    $("#advancedUser").prop("checked", window.au ? "checked" : "");
}

function saveSettingsModal() {
    var tradeStationActive = $("#tradeStationActive").prop("checked");
    var advancedUser = $("#advancedUser").prop("checked");

    var data = {
        advancedChecked: advancedUser,
        tradeStationActive: tradeStationActive
    };

    $.ajax({
        url: "/Account/UpdateSettings",
        type: "POST",
        data: data,
        success: function (data, textStatus, jqXHR) {
            $("#settingsModalWell").text(data);
            $("#settingsModalWell").removeClass("hidden");
            window.au = advancedUser;
            window.tradeStationActive = tradeStationActive;

            setTimeout(function() {
                $("#settingsModalWell").innerText = "";
                $("#settingsModal").data("kendoWindow").close();
                $("#settingsModal").addClass("hide");
                $("#settingsModalWell").addClass("hidden");
                },
                2000);
        },
        error: function (jqXHR, textStatus, errorThrown) {
            $("#settingsModalWell").text(textStatus);
            $("#settingsModalWell").removeClass("hidden");

            setTimeout(function () {
                $("#settingsModal").data("kendoWindow").close();
                $("#settingsModal").addClass("hide");

                $("#settingsModalWell").innerText = textStatus;
                $("#settingsModalWell").addClass("hidden");
                },
                2000);
        }
    });
}

function cancelSettingsModal() {
    $("#settingsModal").data("kendoWindow").close();
    $("#settingsModal").addClass("hide");
}

function showEditProfile() {
    $('#editProfileModal').data('kendoWindow').open();
    $('#editProfile_Description').css('height', Math.min($('#editProfile_Description').prop('scrollHeight'), 300) + "px");

    updateEditDropdownSelected();
}

function updateEditDropdownSelected() {
	if(profile.SocialNetworks === null) return;
	
    var lis = $('#editProfile_SocialNetworks li');
    for (var i = 0; i < profile.SocialNetworks.length; i++) {
        var sn = profile.SocialNetworks[i];

        for (var j = 0; j < lis.length; j++) {
            var li = lis[j];

            var input = $(li).children('input:not(.kendo-dropdown)');

            if (sn.dropdown) {
                var dropdown = sn.dropdown.data('kendoDropDownList');

                if (sn.user && sn.user == input.val())
                    dropdown.value(sn.value);
                else if (sn.email && sn.email == input.val())
                    dropdown.value(sn.value);
            }
        }
    }
}

function expandProfile() {
    var expandedProfile = $('.expandedProfile');
    if (expandedProfile.hasClass('hidden')) {
        expandedProfile.removeClass('hidden');
        expandedProfile[0].previousElementSibling.innerText = 'Collapse Profile';
    }
    else {
        expandedProfile.addClass('hidden');
        expandedProfile[0].previousElementSibling.innerText = 'Expand Profile';
    }
}

function hideProfile() {
    if (chatBody.hasClass('hidden')) chatBody.removeClass('hidden');
    if (chatFooter.hasClass('hidden')) chatFooter.removeClass('hidden');

    if (!profileBlade.hasClass('hidden')) profileBlade.addClass('hidden');
}

function hideConnections() {
    getProfile();
    if (profileBlade.hasClass('hidden')) profileBlade.removeClass('hidden');

    if (!profileConnections.hasClass('hidden')) profileConnections.addClass('hidden');
}

function hideSubscriptions() {
    getProfile();
    if (profileBlade.hasClass('hidden')) profileBlade.removeClass('hidden');

    if (!profileSubscriptions.hasClass('hidden')) profileSubscriptions.addClass('hidden');
}

function hideBlockedUsers() {
    getProfile();
    if (profileBlade.hasClass('hidden')) profileBlade.removeClass('hidden');

    if (!profileBlockedUsers.hasClass('hidden')) profileBlockedUsers.addClass('hidden');
}

function toggleList(target) {
    var list = $(target).children('ul');

    if (list.hasClass('hidden'))
        list.removeClass('hidden');
    else
        list.addClass('hidden');
}

function addSocialNetwork(existing) {
    if (!existing)
        $('#editProfileModal button.btn.current-menu-item').prop('disabled', true);

    var ul = $('#editProfile_SocialNetworks');
    var li = document.createElement('li');

    var close = document.createElement('button');
    close.classList = 'fa fa-close';
    close.style.background = 'none';
    close.style.border = 'none';
    close.style.fontSize = '0.5em';
    close.style.marginRight = '11px';

    close.onclick = function() {
        this.parentElement.parentElement.removeChild(this.parentElement);
        updateAllowed();
    };

    var input = document.createElement('input');
    input.style.width = "52%";
    input.oninput = function (e) {
        if (!e.target.value)
            $('#editProfileModal button.btn.current-menu-item').prop('disabled', true);
        else
            $('#editProfileModal button.btn.current-menu-item').prop('disabled', false);
    };

    // Note, if we end up with some hypothetical template that doesn't use email or a url, this will need to be changed.
    if (existing)
        input.value = existing.user ? existing.user : existing.email;
    else
        input.placeholder = options[0].placeholder;

    var span = document.createElement('span');
    span.style.position = 'absolute';

    var dropdown = document.createElement('input');
    dropdown.classList = "kendo-dropdown";

    li.appendChild(close);
    li.appendChild(span);
    li.appendChild(dropdown);
    li.appendChild(input);

    ul.append(li);
    
    $(dropdown).kendoDropDownList({
        popup: {
            appendTo: $(span),
            position: 'bottom left',
            origin: 'top left',
            collision: 'flip'
        },
        dataValueField: 'value',
        dataTextField: 'value',
        template: '<span class="#: value #"></span>',
        valueTemplate: '<span class="#: value #"></span>',
        dataSource: {
            data: options
        },
        animation: {
            open: {
                effects: 'slideIn:up'
            }
        }
    });

    if (existing)
        existing.dropdown = $(dropdown);
    else
        profile.SocialNetworks.push(
            {
                dropdown: $(dropdown)
            }
        )
}

function updateSocialTemplate() {
    var input = this.parentElement.getElementsByTagName('input')[0]
    input.placeholder = this[this.selectedIndex].attributes.placeholder.value;
}

// Credit: https://stackoverflow.com/questions/3426404/create-a-hexadecimal-colour-based-on-a-string-with-javascript
function stringToColor(str) {
    // var hash = 0;
    // for (var i = 0; i < str.length; i++)
    //     hash = str.charCodeAt(i) + ((hash << 4) - hash);

    //     var color = '#';
    //     for(var i = 0; i < 3; i++) {
    //         var value = (hash >> (i * 5)) & 0xFF;
    //         color += ('00' + value.toString(16)).substr(-2);
    //     }
    //     return color;
    switch (str[0].toLowerCase())
    {
        case 'a': return '#797';
        case 'b': return '#977';
        case 'c': return '#902';
        case 'd': return '#3a3';
        case 'e': return '#905';
        case 'f': return '#995';
        case 'g': return '#470';
        case 'h': return '#609';
        case 'i': return '#459';
        case 'j': return '#449';
        case 'k': return '#66f';
        case 'l': return '#f67';
        case 'm': return '#7a7';
        case 'n': return '#4d4';
        case 'o': return '#44d';
        case 'p': return '#d44';
        case 'q': return '#575';
        case 'r': return '#2d2';
        case 's': return '#d22';
        case 't': return '#22d';
        case 'u': return '#2dd';
        case 'v': return '#0de';
        case 'w': return '#00f';
        case 'x': return '#f00';
        case 'y': return '#f0f';
        case 'z': return '#549';
        default: return '';
    }
}

// Generic functions for use in registration, settings, and profiles
function updateAllowed() {
    if (!validateProfile()) {
        $('#editProfileModal button.btn.current-menu-item').prop('disabled', true);
    }
    else {
        $('#editProfileModal button.btn.current-menu-item').prop('disabled', false);
    }
}

function validateProfile() {
    var updateProfileDisabled = $('#editProfileModal button.btn.current-menu-item').prop('disabled');
    $('#invalidEmailAddress').hide();
    $(`#emailAvailableMessage`).hide();
    $(`${editSelector}screenNameAvailableMessage`).hide();

    var valid = checkEmailAvailability(function (v) {
        updateProfileCallback(updateProfileDisabled, v)
    });
    
    if (!checkScreenNameAvailability(function (v) {
        updateProfileCallback(updateProfileDisabled, v)
    }))
        valid = false;

    return valid;
}

// callback for use with checkEmailAvailability and checkScreenNameAvailability because the ajax causes a race condition.
function updateProfileCallback(isDisabled, valid) {
    var currentState = $('#editProfileModal button.btn.current-menu-item').prop('disabled');

    if ((!isDisabled && !valid) || // Case, the update button is enabled and needs to be disabled because one of the functions returned false
        (!currentState && !valid)) { 
        $('#editProfileModal button.btn.current-menu-item').prop('disabled', true);
    }
}

function validateEmailFormat(email) {
    var regex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return regex.test(String(email).toLowerCase());
}

function checkEmailForReservedWords(email) {
    var unSelector = editSelector ? `${editSelector}Email` : '#EmailAddress';
    var unMsgSelector = editSelector ? `${editSelector}emailAvailableMessage` : '#emailAvailableMessage';

    // Flag email account if it matches one of several keywords bbs identified as professional names.
    email = email.toLowerCase();

    var validEmailAddress = keywords.filter(function (value) { return email.indexOf(value) !== -1; }).length === 0;
    $('#invalidEmailAddress').hide();
    if (!validEmailAddress) {
        $('#invalidEmailAddress').show();
    }

    return validEmailAddress;
}

function checkEmailAvailability(callback) {
    var unSelector = editSelector ? `${editSelector}Email` : '#EmailAddress';
    var unMsgSelector = editSelector ? `${editSelector}emailAvailableMessage` : '#emailAvailableMessage';

    $(unMsgSelector).hide();

    // If email has not changed, return valid
    if (editSelector && profile.Email === $(`${editSelector}Email`).val()) {
        return true;
    }

    var email = $(unSelector).val();

    // Hacky workaround for the Settings page to properly grab the email input
    if (!email) {
        unSelector = '#EmailDisplay';
        email = $(unSelector).val();
    }

    // Check for no email entered at all
    if (email === "") {
        $(unMsgSelector).html("A valid email account a required field");
        $(unMsgSelector).css("color", "red");
        $(unMsgSelector).show();
        emailValid = false;
        return false;
    }

    // Check for professional email addresses
    if (!checkEmailForReservedWords(email))
        return false;

    // Only performing this step for the edit modal for now. The other edit views already validate.
    if (editSelector && !validateEmailFormat(email)) {
        $(unMsgSelector).html("The email addressed entered is not a valid email address.");
        $(unMsgSelector).css("color", "red");
        $(unMsgSelector).show();
        emailValid = false;
        return false;
    }

    // Check for in-use email address to prevent duplicates
    $.post("/Account/VerifyUserName", { userName: email },
        function (result) {
            if (result === 'True') {
                $(unMsgSelector).html(email + " is already in use.  Try another email or <a href='/Account/Login'>Login</a>.");
                $(unMsgSelector).css("color", "red");
                $(unMsgSelector).show();
                emailValid = false;
                
                if (typeof(checkForCompleteAccount) != 'undefined')
                    checkForCompleteAccount();

                if (typeof(callback) == 'function') {
                    callback(false);
                }

                return false;
            }
            else {
                $(unMsgSelector).html("");
                $(unMsgSelector).css("color", "lightgreen");
                $(unMsgSelector).show();
                emailValid = true;
                
                if (typeof(checkForCompleteAccount) != 'undefined')
                    checkForCompleteAccount();

                if (typeof(callback) == 'function') {
                    callback(true);
                }

                return true;
            }
        });
}

function checkScreenNameAvailability(callback) {
    var scSelector = editSelector ? `${editSelector}ScreenName` : '#ScreenName';
    var scMsgSelector = editSelector ? `${editSelector}screenNameAvailableMessage` : '#screenNameAvailableMessage';

    var ScreenName = $(scSelector).val();
    var screenNameMessage = $(scMsgSelector);

    screenNameMessage.hide();

    if (editSelector && profile.ScreenName == $(`${editSelector}ScreenName`).val()) {
        return true;
    }

    if (ScreenName === "") {
        screenNameMessage.show();
        screenNameMessage.html("Screen name is a required field");
        screenNameMessage.css("color", "red");
        screenNameMessage.show();
        screenNameValid = false;
        return false;
    }

    if (/\W/.test(ScreenName)) {
        screenNameMessage.show();
        screenNameMessage.html(ScreenName + " is not valid.  Only use letters, numbers, and the underscore character.");
        screenNameMessage.css("color", "red");
        screenNameMessage.show();
        screenNameValid = false;
        return false;
    }

    $.post("/Account/VerifyScreenName", { screenName: ScreenName },
        function (result) {
            if (result === 'True') {
                screenNameMessage.html(ScreenName + " is already taken.  Try another screen name.");
                screenNameMessage.css("color", "red");
                screenNameMessage.show();
                screenNameValid = false;
                
                if (typeof(checkForCompleteAccount) != 'undefined')
                    checkForCompleteAccount();

                if (typeof(callback) == 'function') {
                    callback(false);
                }

                return false;
            } else {
                image = '<span class="fa fa-check-square" aria-hidden="true"></span>';
                screenNameMessage.html(ScreenName + " is available.");
                screenNameMessage.css("color", "lightgreen");
                screenNameMessage.show();
                screenNameValid = true;
                
                if (typeof(checkForCompleteAccount) != 'undefined')
                    checkForCompleteAccount();

                if (typeof(callback) == 'function') {
                    callback(true);
                }

                return true;
            }
        });

    return true;
}

function displayProfileList(displayType, connectionType = '') {

    var displayId;

    switch (displayType) {
    case 'Connections':
        if (connectionType === "Followers") {
            addProfileList(profile["Followers"], 'Connections', strFollowers);
        }
        else if (connectionType === "Following") {
            addProfileList(profile["Following"], 'Connections' , strFollowing);
        }
        displayId = profileConnections;
        break;
    case 'Subscriptions':
        addProfileList(profile["SubscribedChannels"], 'Subscriptions');
        displayId = profileSubscriptions;
        break;
    case 'BlockedUsers':
        addProfileList(getBlockedUsers(), 'BlockedUsers');
        displayId = profileBlockedUsers;
        break;
    case 'Mentions':
        hideProfile();
        openChatMentions();
        break;
    default:

        break;
    }

    if (displayId.parent()[0] != chatParent[0])
        chatParent.append(displayId);

    if (!profileBlade.hasClass('hidden')) profileBlade.addClass('hidden');

    if (displayId.hasClass('hidden')) displayId.removeClass('hidden');
}

function addProfileList(data, listname, listType = '') {
    var ul;
    var buttonValue;
    var buttonName;
    var className;
    var updateFunction;

    switch (listname) {
        case 'Connections':
            ul = $('#profileConnectionList');
            buttonValue = "Following";
            buttonName = "_button";
            className = "connectionbutton";
            updateFunction = "updateFollowing(this.id)";
            break;
        case 'Subscriptions':
            ul = $('#profileSubscriptionList');
            buttonValue = "Subscribed";
            buttonName = "subscribebutton";
            className = "subscribebutton";
            updateFunction = "updateSubscription(this.id)";
            break;
        case 'BlockedUsers':
            ul = $('#profileBlockedUsersList');
            buttonValue = "Unblock";
            buttonName = "_unblockbutton";
            className = "subscribebutton";
            updateFunction = "unblockUser(this.id)";
            break;
        default:

            break;
    }

    ul.empty();

    for (var user = 0; user < data.length; user++) {
        if (data[user] !== '') {
            var username;
            if (listname === 'Connections' && listType === strFollowers && profile["Followers"].includes(data[user])) {
                buttonValue = "Follow";
            }

            if (listname === 'Connections' || listname === 'Subscriptions') {
                username = data[user];
            }
            else if (listname === 'BlockedUsers') {
                username = data[user].Name;
            }


            var listItem =
                `<li style="list-style: none; margin-bottom: 20px 0; margin-top: 10px; margin-bottom: 10px;">
                <div class="connectionGrid">
                    <div class="Image">
                        <img class="avatar imgAvatar" style="height: 40px; width: 40px; position: absolute;" src="https://blackboxstocks.ems.host/_matrix/media/r0/thumbnail/blackboxstocks.com/ad8a6e0f8d2d227e37a1adf2af8f06c7adb6d7c0?width=96&height=96&method=crop"/>
                    </div>

                    <div class="Name">
                        ${username}
                    </div>

                    <div class="Button">
                        <button id=${username + buttonName} class="${className}" onclick="${updateFunction}">${buttonValue}</button>
                    </div>
                </div>
             </li>`;
            ul.append(listItem);
        }
    }
}

function updateFollowing(buttonId) {

    //buttonId is always '{username}_button' so get Follow/Following from buttonId
    var usernameInArray = 0;
    var btnConnection = document.getElementById(buttonId);
    var ScreenName = buttonId.replace("_button", "")[usernameInArray];

    if (btnConnection.textContent === "Following") {
        updateConnectionsAndSubscriptions("/Profile/RemoveFollowUser", ScreenName);
        btnConnection.textContent = "Follow";
    }
    else if (btnConnection.textContent === "Follow") {
        updateConnectionsAndSubscriptions("/Profile/AddFollowUser", ScreenName);
        btnConnection.textContent = "Following";
    }

}

function updateSubscription(buttonId) {

    //buttonId is always '{username}subscribebutton' so get Follow/Following from buttonId
    var usernameInArray = 0;
    var btnSubscription = document.getElementById(buttonId);
    var ScreenName = buttonId.replace("_subscribebutton", "")[usernameInArray];

    if (btnSubscription.textContent === "Subscribed") {
        updateConnectionsAndSubscriptions("/Profile/UnsubscribeToUser", ScreenName);
        btnSubscription.textContent = "Subscribe";
    }
    else if (btnSubscription.textContent === "Subscribe") {
        updateConnectionsAndSubscriptions("/Profile/SubscribeToUser", ScreenName);
        btnSubscription.textContent = "Subscribed";
    }

}

function unblockUser(buttonId) {

    //buttonId is always '{username}_unblockbutton' so get Follow/Following from buttonId
    var usernameInArray = 0;
    var btnBlock = document.getElementById(buttonId);
    var userName = buttonId.replace("_unblockbutton", "");

    if (btnBlock.textContent === "Unblock") {
        var blockedUsers = getBlockedUsers();
        blockedUsers = blockedUsers.filter(function (item) {
            return item.Name !== userName;
        });

        localStorage.setItem("blockedUsers", JSON.stringify(blockedUsers));
        var test = blockedUsers;
        window.dispatchEvent(new Event('storage'));
        btnBlock.style.visibility = 'hidden';
    }
}

function updateConnectionsAndSubscriptions(url, ScreenName) {

    $.ajax({
        url: url,
        type: "GET",
        contentType: 'application/json',
        data: { ScreenName: ScreenName },
        success: function (data) {

        },
        fail: function (e) {
            console.error(e);
        }
    });
}

function mentionsCount(selector) {

    $.ajax({
        url: "/Profile/GetMentions",
        type: "GET",
        contentType: 'application/json',
        success: function (data) {
            if (data !== null) {
                var el = $(selector);

                el.children('.count').prop('innerText', data.length);
            }
        },
        fail: function (e) {
            console.error(e);
        }
    });
}

function blockedUserCount(selector) {
    var blockedUserList = getBlockedUsers();

    if (blockedUserList !== null) {
        var el = $(selector);

        el.children('.count').prop('innerText', blockedUserList.length);
    }
}

function getBlockedUsers() {
    var blockedUsers = JSON.parse(localStorage.getItem("blockedUsers"));

    return blockedUsers;
}

function getScreenNameFromUserId(userid) {
    return userid;
}
