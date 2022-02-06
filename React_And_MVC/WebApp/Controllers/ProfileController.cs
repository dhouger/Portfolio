using System.Collections.Generic;
using System.Threading.Tasks;
using System.Web.Mvc;
using CyfPortal.Web.App_Helpers;
using CyfPortal.Web.Models;
using CyfPortal.Web.Security;
using Microsoft.AspNet.Identity;

namespace CyfPortal.Web.Controllers
{
    [Authorize]
    public class ProfileController : Controller
    {

        public JsonResult GetRole()
        {
            var role = User.IsInRole("Admin") ? "0f16da2a" : User.IsInRole("Moderator") ? "dd3a2be3" : "";
            return Json(role);
        }


        #region following
        public async Task<JsonResult> GetFollowers()
        {
            var token = TokenHelpers.GetToken(User.Identity.Name, User.Identity.GetUserId());
            var followers = await BlackboxApi.GenericRequest<List<UserConnection>>( token, "GetFollowers");
            return Json(followers, JsonRequestBehavior.AllowGet);
        }

        public async Task<JsonResult> FollowUser(string screenName)
        {
            var model = new UpdateProfileModel
            {
                Token = TokenHelpers.GetToken(User.Identity.Name, User.Identity.GetUserId()),
                ScreenName = screenName
            };

            var following = await BlackboxApi.GenericPostRequest<List<UserConnection>, UpdateProfileModel>("FollowUser", model);

            return Json(following, JsonRequestBehavior.AllowGet);
        }

        public async Task<JsonResult> UnfollowUser(string screenName)
        {

            var model = new UpdateProfileModel
            {
                Token = TokenHelpers.GetToken(User.Identity.Name, User.Identity.GetUserId()),
                ScreenName = screenName
            };
            var following = await BlackboxApi.GenericPostRequest<List<UserConnection>,UpdateProfileModel>("UnfollowUser", model);
            return Json(following, JsonRequestBehavior.AllowGet);

        }

        #endregion

        #region mentions

        public async Task<JsonResult> MarkMentionsViewed(List<UserNotifications> updatedMentions)
        {
            var model = new UpdateUserNotifications
            {
                Token = TokenHelpers.GetToken(User.Identity.Name, User.Identity.GetUserId()),
                UserNotifications = updatedMentions
            };
            var mentions = await BlackboxApi.GenericPostRequest<List<UserNotifications>, UpdateUserNotifications>("MarkMentionsViewed", model);
            return Json(mentions, JsonRequestBehavior.AllowGet);
        }

        public async Task<JsonResult> GetMentions()
        {
            var token = TokenHelpers.GetToken(User.Identity.Name, User.Identity.GetUserId());
            var mentions = await BlackboxApi.GenericRequest<List<UserNotifications>>(token, "GetMentions");
            return Json(mentions, JsonRequestBehavior.AllowGet);
        }
        #endregion

        #region Subscriptions
        public async Task<JsonResult> SubscribeToUser(string screenName)
        {
            var model = new UpdateProfileModel
            {
                Token = TokenHelpers.GetToken(User.Identity.Name, User.Identity.GetUserId()),
                ScreenName = screenName
            };

            var userProfile = await BlackboxApi.GenericPostRequest<UserProfile,UpdateProfileModel>("SubscribeToUser", model);
            return Json(userProfile.SubscribedChannels, JsonRequestBehavior.AllowGet);
        }


        public async Task<JsonResult> UnsubscribeFromUser(string screenName)
        {
            var model = new UpdateProfileModel
            {
                Token = TokenHelpers.GetToken(User.Identity.Name, User.Identity.GetUserId()),
                ScreenName = screenName
            };

            var subscriptions = await BlackboxApi.GenericPostRequest<List<UserConnection>,UpdateProfileModel>("UnsubscribeFromUser", model);
            return Json(subscriptions, JsonRequestBehavior.AllowGet);
        }

        public async Task<JsonResult> GetSubscribedChannels()
        {
            var token = TokenHelpers.GetToken(User.Identity.Name, User.Identity.GetUserId());
            var subscriptions = await BlackboxApi.GenericRequest<List<UserConnection>>( token, "GetSubscribedChannels");
            return Json(subscriptions, JsonRequestBehavior.AllowGet);
        }

        #endregion

        #region user profile
        public async Task<JsonResult> GetUserProfile(string userId)
        {
            var token = TokenHelpers.GetToken(User.Identity.Name, User.Identity.GetUserId());
            var userProfile = await BlackboxApi.GenericRequest<UserProfile>(token, "GetUserProfile");
            return Json(userProfile, JsonRequestBehavior.AllowGet);
        }

        public async Task<JsonResult> GetPopupProfile(string userId)
        {
            var token = TokenHelpers.GetToken(User.Identity.Name, User.Identity.GetUserId());
            var userProfile = await BlackboxApi.GenericRequest<PopupUserProfile>(token, $"GetPopupProfile/{userId}");
            return Json(userProfile, JsonRequestBehavior.AllowGet);
        }

        public async Task<JsonResult> UpdateCombinedProfile(UserProfile user)
        {
            var model = new UpdateCombinedProfileModel
            {
                Profile = user,
                Token = TokenHelpers.GetToken(User.Identity.Name, User.Identity.GetUserId())
            };

            var userProfile = await BlackboxApi.GenericPostRequest<UserProfile, UpdateCombinedProfileModel>("UpdateCombinedProfile", model);
            return Json(userProfile, JsonRequestBehavior.AllowGet);
        }       

        #endregion


    }
}