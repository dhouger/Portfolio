using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace CyfPortal.Web.Models
{
    public class UpdateProfileModel
    {
        public string Id { get; set; }
        public string ScreenName { get; set; }
        public string Token { get; set; }

    }
    
    public class UpdateCombinedProfileModel
    {
        public UserProfile Profile { get; set; }
        public string Token { get; set; }
    }


    public class UserConnection
    {
        public string UserId { get; set; }
        public string ScreenName { get; set; }
        public bool MutualConnection { get; set; }
    }

    public class PopupUserProfile 
    {
    
        public bool MutualConnection { get; set; }
        public int Followers { get; set; }
        public int Following { get; set; }
        public int Subscribers { get; set; }
        public string Description { get; set; }
        public object SocialNetworks { get; set; }
    }

    public class Profile
    {
        [Key]
        public int IdChatUserProfile { get; set; }
        public string UserId { get; set; }
        public string ProfileImageFileName { get; set; }
    }


    public class UserProfile
    {
        public string Id { get; set; }
        public string ScreenName { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string Email { get; set; }
        public string PhoneNumber { get; set; }
        public string Description { get; set; }
        public List<UserConnection> Following { get; set; }
        public List<UserConnection> Followers { get; set; }
        public List<UserConnection> SubscribedChannels { get; set; }
        public List<string> BlockedUsers { get; set; }
        public List<string> Mentions { get; set; }
        public object SocialNetworks { get; set; }
        public string ProfileImageFileName { get; set; }

    }

}