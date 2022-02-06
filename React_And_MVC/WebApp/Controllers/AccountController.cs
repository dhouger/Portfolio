using AuthorizeNet.Api.Contracts.V1;
using CyfPortal.Web.App_Helpers;
using CyfPortal.Web.Authorize.Net.RecurringBilling;
using CyfPortal.Web.Models;
using hbehr.recaptcha;
using Microsoft.AspNet.Identity;
using Microsoft.AspNet.Identity.Owin;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Owin.Security;
using Org.BouncyCastle.Crypto;
using Org.BouncyCastle.Crypto.Parameters;
using Org.BouncyCastle.Security;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Threading.Tasks;
using System.Web;
using System.Web.Mvc;
using Newtonsoft.Json;
// ReSharper disable InconsistentNaming
// ReSharper disable RedundantCaseLabel
// ReSharper disable RedundantAnonymousTypePropertyName

namespace CyfPortal.Web.Controllers
{
    [Authorize]
    public class AccountController : Controller
    {

        private ApplicationSignInManager _signInManager;
        private ApplicationUserManager _userManager;

        public AccountController(){}
        public AccountController(ApplicationUserManager userManager, ApplicationSignInManager signInManager)
        {
            UserManager = userManager;
            SignInManager = signInManager;
        }

        public ApplicationSignInManager SignInManager
        {
            get => _signInManager ?? HttpContext.GetOwinContext().Get<ApplicationSignInManager>();
            private set => _signInManager = value;
        }

        public ApplicationUserManager UserManager
        {
            get => _userManager ?? HttpContext.GetOwinContext().GetUserManager<ApplicationUserManager>();
            set => _userManager = value;
        }

        //
        // GET: /Account/Login
        public async Task<ActionResult> SendEmails(string returnUrl)
        {
            var user = UserManager.FindById(User.Identity.GetUserId());
            await MandrilSender.SendAccountCreationTemplate(user);
            await MandrilSender.SendWelcomeEmailTemplate(user);
            return RedirectToAction("Index", "BlackBox");

        }

        //
        // GET: /Account/Login
        [AllowAnonymous]
        public ActionResult Login(string returnUrl)
        {
            ViewBag.ReturnUrl = returnUrl;
            return View();
        }

        public ActionResult GetUserInfo()
        {
            var user = UserManager.FindById(User.Identity.GetUserId());

            var context = System.Web.HttpContext.Current;
            var ipAddress = context.Request.ServerVariables["HTTP_X_FORWARDED_FOR"];
            var userIp = context.Request.ServerVariables["REMOTE_ADDR"];

            if (!string.IsNullOrEmpty(ipAddress))
            {
                var addresses = ipAddress.Split(',');
                userIp = addresses.Length != 0 ? addresses[0] : context.Request.ServerVariables["REMOTE_ADDR"];
            }

            var userInformation = new UserInformation()
            {
                IsAdmin = user.IsAdmin.ToString(),
                UserId = user.Id,
                IpAddress = userIp,
                IsMobile = Utils.BrowserIsMobile(),
                SessionId = HttpContext.Session.SessionID
            };

            return Json(userInformation);
        }

        public ActionResult FindUsers(string partialUserName)
        {

            var foundUsersPartial = UserManager.Users.Where(user => user.ScreenName.ToLower().Contains(partialUserName) &&
                                                                    user.ExchangeAgreementsCompleted &&
                                                                    (user.SubscriptionId == 999999 || 
                                                                     user.SubscriptionId == 999998 || 
                                                                     !user.CancelledDate.HasValue || 
                                                                     user.CancelledDate >= DateTime.Now)).Select(user => new { ChatUserId = user.Id, user.ScreenName, user.UserName }).ToList();


            return Json(JsonConvert.SerializeObject(foundUsersPartial));
        }

        [AllowAnonymous]
        public ActionResult DisplaySuspended()
        {
            var user = UserManager.FindById(User.Identity.GetUserId());

            if (user == null) return null;
            var daysToCancel = user.CancelledDate.HasValue ? (user.CancelledDate.Value - DateTime.Now).TotalDays : 0.0d;

            if (user.SuspendedDate.HasValue && user.CancelledDate.HasValue && (daysToCancel > 0 && daysToCancel <= 1.0))
            {
                return PartialView("_Suspended");
            }

            return null;
        }


        //
        // POST: /Account/Login
        [HttpPost]
        [AllowAnonymous]
        public async Task<ActionResult> Login(LoginViewModel model, string returnUrl)
        {
            var userResponse = HttpContext.Request.Params["g-recaptcha-response"];

            var validCaptcha = true;
            try
            {

                validCaptcha = await ReCaptcha.ValidateCaptchaAsync(userResponse);
            }
            catch (Exception ex)
            {
                LogMessages.LogError(new ErrorLogging()
                {
                    Controller = "CyfPortal.Web.Controllers.AccountController",
                    Message = ex.Message,
                    MessageDate = DateTime.Now,
                    Source = ex.Source,
                    Stacktrace = ex.StackTrace
                });

                var message = new MailMessage()
                {
                    Body = ex.StackTrace,
                    Subject = ex.Message,
                };
                message.To.Add("operations@blackboxstocks.com, development@blackboxstocks.com");
                SendEmail.Send(message);
            }

            if (!validCaptcha)
            {
                ModelState.AddModelError(string.Empty, @"Failed reCaptcha Check");
            }

            if (!ModelState.IsValid)
            {
                return View(model);
            }

            var user = UserManager.FindByEmail(model.Email.Trim()) ?? UserManager.FindByName(model.Email.Trim());

            if ((user?.UserName) != null)
            {
                var result = await SignInManager.PasswordSignInAsync(user.UserName, model.Password, model.RememberMe, shouldLockout: false);
                switch (result)
                {
                    case SignInStatus.Success:
                        if (returnUrl != null)
                        {
                            return Redirect(returnUrl);
                        }
                        return RedirectToAction("Index", "BlackBox");
                    case SignInStatus.LockedOut:
                        return View("Lockout");
                    case SignInStatus.RequiresVerification:
                        return RedirectToAction("SendCode", new { ReturnUrl = returnUrl, RememberMe = model.RememberMe });
                    case SignInStatus.Failure:
                    default:
                        ModelState.AddModelError("", @"Invalid login attempt.");
                        return View(model);
                }
            }
            ModelState.AddModelError("", @"Invalid login attempt.");
            return View(model);
        }

        [AllowAnonymous]
        public ViewResult GiftCardPurchase()
        {
            return View("GiftCardPurchase");
        }

        [HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> LoginJson(string username, string password, bool? rememberme)
        {

            var user = UserManager.FindByEmail(username) ?? UserManager.FindByName(username);

            if (user == null || user.UserName == null)
            {
                ModelState.AddModelError("", @"Invalid login attempt.");
                return Json(false);
            }

            var remember = rememberme != null && rememberme.Value;
            var result = await SignInManager.PasswordSignInAsync(user.UserName, password, remember, shouldLockout: false);
            //var result = await SignInManager.PasswordSignInAsync(username, password, remember, shouldLockout: false);
            switch (result)
            {

                case SignInStatus.Success:
                    return Json(true);
                case SignInStatus.LockedOut:
                case SignInStatus.RequiresVerification:
                case SignInStatus.Failure:
                    return Json(false);
                default:
                    break;
            }
            return Json(false);
        }

        public ActionResult CompleteNewUser()
        {
            var user = UserManager.FindById(User.Identity.GetUserId());
            user.ViewedNewUserInformation = true;
            UserManager.Update(user);
            return Json(false);
        }

        [AllowAnonymous]
        public ActionResult QuoddLogin(string token)
        {
            //string secret = "testjwtsecretKey";
            //var key = Encoding.ASCII.GetBytes(secret);
            var cert = @"MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwUtQ9QLoCL9QcKV4jo0aYFKHzZmFzmUz+H2vLbQYhDQQs46LyKJQHMLoxruyWuJtqJ5qFgImxWOLhc35Q7MlSso54T5Z+3LtEYKZlTr2jg0jsHkp3dGGlvuU6QMhhWjofYHAxh96OBw96wgUaCAlWV9hfL6dzq8DmXQzQLlWRFPVkkfaAzHx3JuxKiRn3JYQZgkNRyBY2QUCILYmegV7jtWcn6xLENAculG/opbP7SgUFLJazbu0Yuony8uIJj2jdae9LFKcdHqSfMP4VFp6xgwrefCEhFEka2voQAgzujeHE7xteCrzDIeKKMmgv2ajRyMWMP4jvfzhOmfgjnETAwIDAQAB";
            var keyBytes = Convert.FromBase64String(cert); // your key here
            AsymmetricKeyParameter asymmetricKeyParameter = PublicKeyFactory.CreateKey(keyBytes);
            RsaKeyParameters rsaKeyParameters = (RsaKeyParameters)asymmetricKeyParameter;
            RSAParameters rsaParameters = new RSAParameters
            {
                Modulus = rsaKeyParameters.Modulus.ToByteArrayUnsigned(),
                Exponent = rsaKeyParameters.Exponent.ToByteArrayUnsigned()
            };
            using (RSACryptoServiceProvider rsa = new RSACryptoServiceProvider())
            {
                rsa.ImportParameters(rsaParameters);
                var validationParameters = new TokenValidationParameters()
                {
                    RequireExpirationTime = true,
                    RequireSignedTokens = true,
                    ValidateAudience = false,
                    ValidateIssuer = false,
                    IssuerSigningKey = new RsaSecurityKey(rsa)
                };
                var handler = new JwtSecurityTokenHandler();
                //handler.ValidateToken(token, validationParameters, out var tokenSecure);
                SecurityToken tokenSecure;
                try
                {
                    handler.ValidateToken(token, validationParameters, out tokenSecure);
                }
                catch (SecurityTokenException)
                {
                    //return new HttpUnauthorizedResult();
                    return new HttpStatusCodeResult(402);
                }
                catch (Exception)
                {
                    return new HttpStatusCodeResult(500);
                }
                var payload = ((JwtSecurityToken)tokenSecure).Claims.ToList();
                var email = payload.First(x => x.Type == "email").Value;
                var hasOtc = payload.First(x => x.Type == "isOtc").Value.ToLower().Equals("true");
                TempData["HasOtc"] = hasOtc;
                TempData["QuoddLogin"] = true;
                var user = UserManager.FindByName(email);
                if (user != null)
                {
                    SignInManager.SignIn(user, false, false);
                    return RedirectToAction("Index", "BlackBox");
                }
                //TODO:  Check to make sure user name is unique
                var newUser = new ApplicationUser
                {
                    UserName = email,
                    Email = email,
                    FirstName = payload.First(x => x.Type == "first_name").Value,
                    LastName = payload.First(x => x.Type == "last_name").Value,
                    ScreenName = payload.First(x => x.Type == "user_name").Value,
                    CancelledDate = DateTime.Now.AddDays(30),
                    Cancelled = true,
                    Subscribed = true,
                    SubscriptionId = 1111,
                    CreatedDate = DateTime.Now,
                    ExchangeAgreementsCompletedDate = DateTime.Now,
                    ExchangeAgreementsCompleted = true,
                    ReferralCode = "QUODD Direct"
                };
                var result = UserManager.Create(newUser);
                if (result.Succeeded)
                {
                    SignInManager.SignIn(UserManager.FindByName(email), false, false);
                    return RedirectToAction("Index", "BlackBox");
                }
            }
            return RedirectToAction("Error", "Account");
        }



        private List<string> GetReferralSources()
        {
            List<string> referrals;
            using (var context = new ReferralSourceContext())
            {
                List<ReferralSource> rs = context.ReferralSources.ToList();
                rs.Sort();
                referrals = rs.Select(x => x.ReferralName).ToList();
            }

            return referrals;
        }

        

        //
        // GET: /Account/VerifyCode
        [AllowAnonymous]
        public async Task<ActionResult> VerifyCode(string provider, string returnUrl, bool rememberMe)
        {
            // Require that the user has already logged in via username/password or external login
            if (!await SignInManager.HasBeenVerifiedAsync())
            {
                return View("Error");
            }
            return View(new VerifyCodeViewModel { Provider = provider, ReturnUrl = returnUrl, RememberMe = rememberMe });
        }

        //
        // POST: /Account/VerifyCode
        [HttpPost]
        [AllowAnonymous]
        [ValidateAntiForgeryToken]
        public async Task<ActionResult> VerifyCode(VerifyCodeViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            // The following code protects for brute force attacks against the two factor codes. 
            // If a user enters incorrect codes for a specified amount of time then the user account 
            // will be locked out for a specified amount of time. 
            // You can configure the account lockout settings in IdentityConfig
            var result = await SignInManager.TwoFactorSignInAsync(model.Provider, model.Code, isPersistent: model.RememberMe, rememberBrowser: model.RememberBrowser);
            switch (result)
            {
                case SignInStatus.Success:
                    return RedirectToLocal(model.ReturnUrl);
                case SignInStatus.LockedOut:
                    return View("Lockout");
                case SignInStatus.Failure:
                default:
                    ModelState.AddModelError("", @"Invalid code.");
                    return View(model);
            }
        }


        public ActionResult ChangePassword(string CurrentPassword, string PasswordValue, string ConfirmPassword)
        {
            if (PasswordValue != ConfirmPassword)
            {
                return Content("Error: New passwords do not match");
            }

            var user = UserManager.FindById(User.Identity.GetUserId());
            var result = UserManager.ChangePassword(user.Id, CurrentPassword, PasswordValue);
            return !result.Succeeded ? Content("Error: " + result.Errors.First()) : Content("Success: Your password was changed!");
        }

        // GET: /Account/Details
        public ActionResult SubscriptionDetailsModal(int? exceededLogins)
        {
            var user = UserManager.FindById(User.Identity.GetUserId());

            if (user.SubscriptionId == 999998) return Content("Not Allowed");

            var proratedAmount =
                user.SubscriptionType != null && user.SubscriptionType.ToLowerInvariant().Equals("monthly")
                    ? Settings.AnnualChargeAmount - AccountHelpers.GetProratedAmount(user)
                    : 0.0m;

            var canCancel = !(user.UpgradeDate.HasValue && (DateTime.Now - user.UpgradeDate.Value).TotalDays < 2);

            if (user.UpdateCreditCardDate.HasValue && (DateTime.Now - user.UpdateCreditCardDate.Value).TotalDays < 2)
            {
                canCancel = false;
            }

            var vm = new RegisterViewModel
            {
                EmailAddress = user.Email,
                EmailDisplay = user.Email,
                FirstName = user.FirstName,
                LastName = user.LastName,
                SubscriberId = user.SubscriptionId.ToString(CultureInfo.InvariantCulture),
                ScreenName = user.ScreenName,
                ScreenIcon = user.ScreenIcon,
                SubscriptionType = user.SubscriptionType,
                TradeStationActive = user.TradeStationActive,
                ProratedAmount = proratedAmount,
                RebillDate = user.NextBillDate.ToString(),
                CanCancel = canCancel,
                SubscribedDate = user.SubscribedDate,
                ReactivatedDate = user.ReactivatedDate,
                ExchangeAgreementsCompletedDate = user.ExchangeAgreementsCompletedDate

            };

            var info = new GetSubscription().Run(vm.SubscriberId);
            if (user.SubscriptionId.ToString(CultureInfo.InvariantCulture).Equals("999999"))
            {
                vm.CardNumber = "Trial Account";
                vm.Expiration = "NA";
                vm.SubscriptionStatus = "Trial";
            }
            else if (info == null)
            {
                vm.CardNumber = "Contact Support";
                vm.Expiration = "999";
                vm.SubscriptionStatus = "Contact Support";
            }
            else
            {
                var ccInfo = ((creditCardMaskedType)(info.profile.paymentProfile.payment.Item));
                if (ccInfo == null)
                {
                    vm.CardNumber = "Contact Support";
                    vm.Expiration = "999";
                    vm.SubscriptionStatus = "Contact Support";
                }
                else   
                {
                    vm.CardNumber = ((creditCardMaskedType)(info.profile.paymentProfile.payment.Item)).cardNumber;
                    vm.Expiration = ((creditCardMaskedType)(info.profile.paymentProfile.payment.Item)).expirationDate;
                    vm.SubscriptionStatus = info.status.ToString();
                }

            }

            if (exceededLogins.HasValue && exceededLogins == 1)
            {
                vm.DisplayLoginMessage = true;
            }

            return View(vm);
        }

       public ActionResult Details(int? exceededLogins)
        {
            var user = UserManager.FindById(User.Identity.GetUserId());

            if (user.SubscriptionId == 999998)
            {
                return RedirectToAction("Index", "BlackBox");
            }

            var proratedAmount =
                user.SubscriptionType != null && user.SubscriptionType.ToLowerInvariant().Equals("monthly")
                    ? Settings.AnnualChargeAmount - AccountHelpers.GetProratedAmount(user) - Settings.PromotionalSavings
                    : 0.0m;

            var canCancel = !(user.UpgradeDate.HasValue && (DateTime.Now - user.UpgradeDate.Value).TotalDays < 2);

            if (user.UpdateCreditCardDate.HasValue && (DateTime.Now - user.UpdateCreditCardDate.Value).TotalDays < 2)
            {
                canCancel = false;
            }

            var vm = new RegisterViewModel
            {
                EmailAddress = user.Email,
                EmailDisplay = user.Email,
                FirstName = user.FirstName,
                LastName = user.LastName,
                SubscriberId = user.SubscriptionId.ToString(CultureInfo.InvariantCulture),
                ScreenName = user.ScreenName,
                ScreenIcon = user.ScreenIcon,
                SubscriptionType = user.SubscriptionType,
                TradeStationActive = user.TradeStationActive,
                ProratedAmount = proratedAmount,
                RebillDate = user.NextBillDate.ToString(),
                CanCancel = canCancel,
                SubscribedDate = user.SubscribedDate,
                ReactivatedDate = user.ReactivatedDate,
                ExchangeAgreementsCompletedDate = user.ExchangeAgreementsCompletedDate

            };

            var info = new GetSubscription().Run(vm.SubscriberId);
            if (user.SubscriptionId.ToString(CultureInfo.InvariantCulture).Equals("999999"))
            {
                vm.CardNumber = "Trial Account";
                vm.Expiration = "NA";
                vm.SubscriptionStatus = "Trial";
            }
            else if (info == null)
            {
                vm.CardNumber = "Contact Support";
                vm.Expiration = "999";
                vm.SubscriptionStatus = "Contact Support";
            }
            else
            {
                var ccInfo = ((creditCardMaskedType)(info.profile.paymentProfile.payment.Item));
                if (ccInfo == null)
                {
                    vm.CardNumber = "Contact Support";
                    vm.Expiration = "999";
                    vm.SubscriptionStatus = "Contact Support";
                }
                else   
                {
                    vm.CardNumber = ((creditCardMaskedType)(info.profile.paymentProfile.payment.Item)).cardNumber;
                    vm.Expiration = ((creditCardMaskedType)(info.profile.paymentProfile.payment.Item)).expirationDate;
                    vm.SubscriptionStatus = info.status.ToString();
                }

            }

            if (exceededLogins.HasValue && exceededLogins == 1)
            {
                vm.DisplayLoginMessage = true;
            }

            return View(vm);
        }


        /// <summary>
        /// Creates a String representation of the next bill date. 
        /// </summary>
        /// <param name="user">Was the account created with a Gift Card</param>
        /// <returns>Formatted string for the next time an account will be billed.</returns>
        private static string NextBillDate(ApplicationUser user)
        {
            var isGiftCard = user.PromotionCode != null && user.PromotionCode.ToLower().Contains("gift card");
            var isTrialAccount = user.SubscriptionId.Equals(999999);
            var currentDate = DateTime.Now;
            if (isGiftCard)
            {
                return "Gift Card " + (user.CancelledDate.HasValue && user.CancelledDate.Value >= currentDate ? "Valid Through " + user.CancelledDate.Value.ToShortDateString() : "Expired");
            }

            if (user.SubscriptionType != "monthly" && user.SubscriptionType != "annual")
                return isTrialAccount ? "Trial Account" : "Unknown";

            if (!user.CancelledDate.HasValue)
            {
                var nextBillDate = DateTime.Now;
                switch (user.SubscriptionType.ToLower())
                {
                    case "monthly":
                    {
                        var monthDifference = Math.Abs(12 * (user.SubscribedDate.Year - currentDate.Year) + user.SubscribedDate.Month - currentDate.Month);
                        nextBillDate = user.SubscribedDate.Day <= currentDate.Day ? user.SubscribedDate.AddMonths(monthDifference) : user.SubscribedDate.AddMonths(monthDifference + 1);
                        break;
                    }
                    case "annual":
                    {
                        var yearDifference = (currentDate.Year - user.SubscribedDate.Year) + (user.SubscribedDate.Month > currentDate.Month || (user.SubscribedDate.Month == currentDate.Month && user.SubscribedDate.Day >= currentDate.Day) ? 1 : 0);
                        nextBillDate = user.SubscribedDate.AddYears(yearDifference);
                        break;
                    }
                }

                return nextBillDate.ToShortDateString();
            }

            var cancelledDate = user.CancelledDate.Value;
            return ((cancelledDate >= currentDate) ? "Expires on " : "Expired on ") + cancelledDate.ToShortDateString();

        }


        // GET: /Account/Details
        [HttpPost]
        //public ActionResult Details(RegisterViewModel vm)
        public ActionResult UpdateDetails(string EmailDisplay, string FirstName, string LastName, string ScreenName, string ScreenIcon, bool TradeStationActive)
        {

            var user = UserManager.FindById(User.Identity.GetUserId());
            var emailUpdated = user.Email.ToLower().Trim() != EmailDisplay.ToLower().Trim();

            if (emailUpdated && !String.IsNullOrEmpty(EmailDisplay.Trim()))
            {
                // Make sure they are using an email that's already being used
                var r = UserManager.Users.FirstOrDefault(x =>
                        (x.UserName != null && x.UserName.ToLower().Trim() == EmailDisplay.ToLower().Trim()) ||
                        (x.Email != null && x.Email.ToLower().Trim() == EmailDisplay.ToLower().Trim())
                    );

                if (r != null && r.Id != user.Id)
                {
                    return Content("Error: That email address can't be used.");
                }

                if (user.SubscriptionId != 999999)
                {
                    // Update authorize.net subscription stuff
                    var customer = new customerType
                    {
                        email = user.Email,
                        type = customerTypeEnum.individual,
                        id = user.InternalId.ToString(CultureInfo.InvariantCulture),
                    };

                    var subscriptionType = new ARBSubscriptionType { customer = customer };
                    var request = new ARBUpdateSubscriptionRequest { subscription = subscriptionType, subscriptionId = user.SubscriptionId.ToString() };
                    var val = new UpdateSubscription().Run(request);

                    if (!val.Contains("Success"))
                    {
                        return Content("Error:  " + val);
                    }

                }

                // Set the account
                user.Email = EmailDisplay;
                user.NormalizedEmail = EmailDisplay.ToUpper();
            }

            if (!String.IsNullOrEmpty(FirstName)) user.FirstName = FirstName;
            if (!String.IsNullOrEmpty(LastName)) user.LastName = LastName;

            var screenName = "";
            if (user.ScreenName != null)
            {
                screenName = user.ScreenName.ToLower();
            }

            if (!String.IsNullOrEmpty(ScreenName) && !screenName.Equals("newbies2") && !screenName.Equals("newbies4")) user.ScreenName = ScreenName;
            if (!String.IsNullOrEmpty(ScreenIcon)) user.ScreenIcon = ScreenIcon;

            user.TradeStationActive = TradeStationActive;

            var saveResult = UserManager.Update(user);

            return !saveResult.Succeeded ? Content("Error:  " + saveResult.Errors.First()) : Content("Success:  Your account was updated");
        }

        [HttpPost]
        public ActionResult UpdateAdvancedUser(bool advancedChecked)
        {
            var user = UserManager.FindById(User.Identity.GetUserId());
            user.AdvancedUser = advancedChecked;
            var saveResult = UserManager.Update(user);

            return !saveResult.Succeeded ? Content("Error:  " + saveResult.Errors.First()) : Content("Success:  Your account was updated");
        }

        [HttpPost]
        public ActionResult UpdateSettings(bool advancedChecked, bool tradeStationActive)
        {
            var user = UserManager.FindById(User.Identity.GetUserId());
            user.AdvancedUser = advancedChecked;
            user.TradeStationActive = tradeStationActive;
            var saveResult = UserManager.Update(user);

            return !saveResult.Succeeded ? Content("Error:  " + saveResult.Errors.First()) : Content("Success:  Your account was updated");
        }


        #region User Settings

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult SaveProfile(string content)
        {
            var user = UserManager.FindById(User.Identity.GetUserId());
            user.Profile = content;
            var saveResult = UserManager.Update(user);
            return !saveResult.Succeeded ? Content("Error:  " + saveResult.Errors.First()) : Content("Success:  Your account was updated");
        }

        public ActionResult GetProfile(string screenName)
        {
            if (String.IsNullOrEmpty(screenName)) return Content("");

            var c = new ApplicationDbContext();
            var r = c.Users.Where(x => x.ScreenName.Equals(screenName)).Select(x => x.Profile).FirstOrDefault();
            return Content(r ?? "");
        }

        public ActionResult GetFollowing()
        {
            var user = UserManager.FindById(User.Identity.GetUserId());
            return Content(user.Following);
        }

        public ActionResult SetFollowing(string content)
        {
            var user = UserManager.FindById(User.Identity.GetUserId());

            if (user.Following != null && user.Following.ToLower().Contains(content.Trim().ToLower())) return Content(user.Following);
            var currentFollowers = new List<string>();
            if (user.Following != null) currentFollowers = user.Following.Split(',').ToList();
            currentFollowers.Add(content);
            user.Following = string.Join(",", currentFollowers.OrderBy(x => x));
            UserManager.Update(user);
            return Content(user.Following);
        }

        public ActionResult Unfollow(string content)
        {
            var user = UserManager.FindById(User.Identity.GetUserId());
            var currentFollowers = user.Following.Split(',').ToList();
            currentFollowers.Remove(content);
            user.Following = string.Join(",", currentFollowers.OrderBy(x => x));
            UserManager.Update(user);
            return Content(user.Following);
        }


        public ActionResult GetBlocked()
        {
            var user = UserManager.FindById(User.Identity.GetUserId());
            return Content(user.Blocked);
        }

        public ActionResult SetBlocked(string content)
        {
            var user = UserManager.FindById(User.Identity.GetUserId());

            if (user.Blocked != null && user.Blocked.ToLower().Contains(content.Trim().ToLower())) return Content(user.Blocked);
            var currentBlocked = new List<string>();
            if (user.Blocked != null) currentBlocked = user.Blocked.Split(',').ToList();

            currentBlocked.Add(content);
            user.Blocked = string.Join(",", currentBlocked.OrderBy(x => x));
            UserManager.Update(user);
            return Content(user.Blocked);
        }
        public ActionResult Unblock(string content)
        {
            var user = UserManager.FindById(User.Identity.GetUserId());
            var currentBlocked = user.Blocked.Split(',').ToList();
            currentBlocked.Remove(content);
            user.Blocked = string.Join(",", currentBlocked.OrderBy(x => x));
            UserManager.Update(user);
            return Content(user.Blocked);
        }

        #endregion


        // GET: /Account/Edit
        public ActionResult Edit()
        {
            return View();
        }

        [AllowAnonymous]
        public ActionResult Error()
        {
            return View();
        }

        public ActionResult Disabled()
        {
            return View();
        }

        //
        // POST: /Account/VerifyCode
        [HttpPost]
        [AllowAnonymous]
        public bool VerifyScreenName(string screenName)
        {
            var c = new ApplicationDbContext();
            var r = c.Users.Any(x => x.ScreenName.ToLower() == screenName.ToLower());
            if (!r)
                r = !screenName.All(l => Char.IsLetterOrDigit(l) || l.Equals('_'));
            return r;
        }

        // POST: /Account/VerifyCode
        [HttpPost]
        [AllowAnonymous]
        public bool VerifyUserName(string userName)
        {
            var c = new ApplicationDbContext();
            var r = c.Users.Any(x => x.UserName.Trim().ToLower() == userName.Trim().ToLower()
                || x.Email.Trim().ToLower() == userName.Trim().ToLower());
            return r;
        }

        // GET: /Account/Register
        [AllowAnonymous]
        public ActionResult Register()
        {
            ViewBag.ReferralSources = GetReferralSources();

            var offerId = Request.QueryString["offer_id"];
            if (string.IsNullOrEmpty(offerId))
            {
                ViewData["monthlyDiscount"] = -1;
                ViewData["annualDiscount"] = -1;
                return View();
            }
            
            var monthlyCampaign = CampaignAccess.GetOfferMonthlyAmount(offerId);
            ViewData["monthlyDiscount"] = monthlyCampaign?.Price ?? -1;

            var annualCampaign = CampaignAccess.GetOfferAnnualAmount(offerId);
            ViewData["annualDiscount"] = annualCampaign?.Price ?? -1;
            return View();
        }


        private async Task<bool> MakeAccount(RegisterViewModel model)
        {
            model.EmailDisplay = model.EmailAddress;
            var user = new ApplicationUser
            {
                UserName = model.EmailAddress,
                Email = model.EmailAddress,
                FirstName = model.FirstName,
                LastName = model.LastName,
                ScreenName = model.ScreenName,
                CreatedDate = DateTime.Now,
                PromotionCode = model.PromotionCode,
                ReferralCode = model.ReferralCode,
                HowFound = model.HowFound,
                PhoneNumber = model.PhoneNumber,
                AffiliateId = model.AffiliateId,
                NormalizedEmail = model.EmailAddress.ToUpper(),
                NormalizedUserName = model.EmailAddress.ToUpper(),
            };

            var result = UserManager.Create(user, model.PasswordValue);

            if (result.Succeeded)
            {
                SignInManager.SignIn(user, isPersistent: false, rememberBrowser: false);

                if (!String.IsNullOrEmpty(user.ReferralCode) && !user.ReferralCode.Contains("DotComSite") &&
                    !user.ReferralCode.Contains("None") && !user.ReferralCode.Contains("GoogleAds"))
                {
                    AffiliateUtilities.HasOffersAccountCreated(user.ReferralCode, model.PromotionCode, user.Email, $"{user.FirstName} {user.LastName}");
                }

                await MandrilSender.SendAccountCreationTemplate(user);
                return true;
            }

            // If we got this far, something failed, return false
            AddErrors(result);
            return false;
        }




        //
        // POST: /Account/Register
        [HttpPost]
        [AllowAnonymous]
        public async Task<ActionResult> CreateAccount(RegisterViewModel model)
        {
            model.EmailAddress = model.EmailAddress.Trim();

            var result = await MakeAccount(model);
            return result ?
                Content("Success for " + model.EmailAddress) :
                Content("Error:  there were problems creating your account " + string.Join("; ", ModelState.Values.SelectMany(x => x.Errors).Select(x => x.ErrorMessage)));
        }

        //
        // POST: /Account/Register
        [HttpPost]
        [AllowAnonymous]
        [ValidateAntiForgeryToken]
        public async Task<ActionResult> Register(RegisterViewModel model)
        {

            if (!ModelState.IsValid) return View("Register");

            var result = await MakeAccount(model);

            if (result)
            {
                return RedirectToAction("Index", "Home");
            }
            // If we got this far, something failed, redisplay form
            return View("Register");
        }



        //
        // GET: /Account/ConfirmEmail
        [AllowAnonymous]
        public async Task<ActionResult> ConfirmEmail(string userId, string code)
        {
            if (userId == null || code == null)
            {
                return View("Error");
            }
            var result = await UserManager.ConfirmEmailAsync(userId, code);
            return View(result.Succeeded ? "ConfirmEmail" : "Error");
        }

        //
        // GET: /Account/ForgotPassword
        [AllowAnonymous]
        public ActionResult ForgotPassword()
        {
            return View(new ForgotPasswordViewModel());
        }

        //
        // POST: /Account/ForgotPassword
        [HttpPost]
        [AllowAnonymous]
        public async Task<ActionResult> ForgotPassword(ForgotPasswordViewModel model)
        {
            // Something failed, redisplay form
            if (!ModelState.IsValid) return View(model);

            var user = UserManager.FindByEmail(model.Email) ?? UserManager.FindByName(model.Email);

            if (user == null)
            {
                // Don't reveal that the user does not exist or is not confirmed
                return View("ForgotPasswordConfirmation");
            }

            // For more information on how to enable account confirmation and password reset please visit http://go.microsoft.com/fwlink/?LinkID=320771
            // Send an email with this link
            var code = await UserManager.GeneratePasswordResetTokenAsync(user.Id);
            var callbackUrl = Url.Action("ResetPassword", "Account", new { userId = user.Id, code = code }, Request.Url.Scheme);
            await UserManager.SendEmailAsync(user.Id, "Reset Password", "Please reset your password by clicking <a href=\"" + callbackUrl + "\">here</a>");
            return RedirectToAction("ForgotPasswordConfirmation", "Account");


        }

        //
        // GET: /Account/ForgotPasswordConfirmation
        [AllowAnonymous]
        public ActionResult ForgotPasswordConfirmation()
        {
            return View();
        }

        //
        // GET: /Account/ResetPassword
        [AllowAnonymous]
        public ActionResult ResetPassword(string code)
        {
            return code == null ? View("Error") : View();
        }

        //
        // POST: /Account/ResetPassword
        [HttpPost]
        [AllowAnonymous]
        [ValidateAntiForgeryToken]
        public async Task<ActionResult> ResetPassword(ResetPasswordViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }
            //var user = await UserManager.FindByNameAsync(model.Email);

            var user = UserManager.FindByEmail(model.Email) ?? UserManager.FindByName(model.Email);

            if (user == null)
            {
                // Don't reveal that the user does not exist
                return RedirectToAction("ResetPasswordConfirmation", "Account");
            }
            var result = await UserManager.ResetPasswordAsync(user.Id, model.Code, model.Password);
            if (result.Succeeded)
            {
                return RedirectToAction("ResetPasswordConfirmation", "Account");
            }
            AddErrors(result);
            return View();
        }

        //
        // GET: /Account/ResetPasswordConfirmation
        [AllowAnonymous]
        public ActionResult ResetPasswordConfirmation()
        {
            return View();
        }

        //
        // POST: /Account/ExternalLogin
        [HttpPost]
        [AllowAnonymous]
        [ValidateAntiForgeryToken]
        public ActionResult ExternalLogin(string provider, string returnUrl)
        {
            // Request a redirect to the external login provider
            return new ChallengeResult(provider, Url.Action("ExternalLoginCallback", "Account", new { ReturnUrl = returnUrl }));
        }

        //
        // GET: /Account/SendCode
        [AllowAnonymous]
        public async Task<ActionResult> SendCode(string returnUrl, bool rememberMe)
        {
            var userId = await SignInManager.GetVerifiedUserIdAsync();
            if (userId == null)
            {
                return View("Error");
            }
            var userFactors = await UserManager.GetValidTwoFactorProvidersAsync(userId);
            var factorOptions = userFactors.Select(purpose => new SelectListItem { Text = purpose, Value = purpose }).ToList();
            return View(new SendCodeViewModel { Providers = factorOptions, ReturnUrl = returnUrl, RememberMe = rememberMe });
        }

        //
        // POST: /Account/SendCode
        [HttpPost]
        [AllowAnonymous]
        [ValidateAntiForgeryToken]
        public async Task<ActionResult> SendCode(SendCodeViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View();
            }

            // Generate the token and send it
            if (!await SignInManager.SendTwoFactorCodeAsync(model.SelectedProvider))
            {
                return View("Error");
            }
            return RedirectToAction("VerifyCode", new { Provider = model.SelectedProvider, ReturnUrl = model.ReturnUrl, RememberMe = model.RememberMe });
        }

        //
        // GET: /Account/ExternalLoginCallback
        [AllowAnonymous]
        public async Task<ActionResult> ExternalLoginCallback(string returnUrl)
        {
            var loginInfo = await AuthenticationManager.GetExternalLoginInfoAsync();
            if (loginInfo == null)
            {
                return RedirectToAction("Login");
            }

            // Sign in the user with this external login provider if the user already has a login
            var result = await SignInManager.ExternalSignInAsync(loginInfo, isPersistent: false);
            switch (result)
            {
                case SignInStatus.Success:
                    return RedirectToLocal(returnUrl);
                case SignInStatus.LockedOut:
                    return View("Lockout");
                case SignInStatus.RequiresVerification:
                    return RedirectToAction("SendCode", new { ReturnUrl = returnUrl, RememberMe = false });
                case SignInStatus.Failure:
                default:
                    // If the user does not have an account, then prompt the user to create an account
                    ViewBag.ReturnUrl = returnUrl;
                    ViewBag.LoginProvider = loginInfo.Login.LoginProvider;
                    return View("ExternalLoginConfirmation", new ExternalLoginConfirmationViewModel { Email = loginInfo.Email });
            }
        }

        //
        // POST: /Account/ExternalLoginConfirmation
        [HttpPost]
        [AllowAnonymous]
        [ValidateAntiForgeryToken]
        public async Task<ActionResult> ExternalLoginConfirmation(ExternalLoginConfirmationViewModel model, string returnUrl)
        {
            if (User.Identity.IsAuthenticated)
            {
                return RedirectToAction("Details", "Account");
            }

            if (ModelState.IsValid)
            {
                // Get the information about the user from the external login provider
                var info = await AuthenticationManager.GetExternalLoginInfoAsync();
                if (info == null)
                {
                    return View("ExternalLoginFailure");
                }
                var user = new ApplicationUser { UserName = model.Email, Email = model.Email };
                var result = await UserManager.CreateAsync(user);
                if (result.Succeeded)
                {
                    result = await UserManager.AddLoginAsync(user.Id, info.Login);
                    if (result.Succeeded)
                    {
                        await SignInManager.SignInAsync(user, isPersistent: false, rememberBrowser: false);
                        return RedirectToLocal(returnUrl);
                    }
                }
                AddErrors(result);
            }

            ViewBag.ReturnUrl = returnUrl;
            return View(model);
        }

        //
        // POST: /Account/LogOff
        [HttpPost]
        [ValidateAntiForgeryToken]
        public ActionResult LogOff()
        {
            AuthenticationManager.SignOut();
            return RedirectToAction("Index", "Home");
        }
        // GET: /Account/LogOff
        public ActionResult LogOut()
        {
            AuthenticationManager.SignOut();
            return RedirectToAction("Index", "Home");
        }
        //
        // GET: /Account/ExternalLoginFailure
        [AllowAnonymous]
        public ActionResult ExternalLoginFailure()
        {
            return View();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                if (_userManager != null)
                {
                    _userManager.Dispose();
                    _userManager = null;
                }

                if (_signInManager != null)
                {
                    _signInManager.Dispose();
                    _signInManager = null;
                }
            }

            base.Dispose(disposing);
        }

        #region Helpers
        // Used for XSRF protection when adding external logins
        private const string XsrfKey = "XsrfId";

        private IAuthenticationManager AuthenticationManager
        {
            get
            {
                return HttpContext.GetOwinContext().Authentication;
            }
        }

        private void AddErrors(IdentityResult result)
        {
            foreach (var error in result.Errors)
            {
                ModelState.AddModelError("", error);
            }
        }

        private ActionResult RedirectToLocal(string returnUrl)
        {
            if (Url.IsLocalUrl(returnUrl))
            {
                return Redirect(returnUrl);
            }
            return RedirectToAction("Index", "Home");
        }

        internal class ChallengeResult : HttpUnauthorizedResult
        {
            public ChallengeResult(string provider, string redirectUri)
                : this(provider, redirectUri, null)
            {
            }

            public ChallengeResult(string provider, string redirectUri, string userId)
            {
                LoginProvider = provider;
                RedirectUri = redirectUri;
                UserId = userId;
            }

            public string LoginProvider { get; set; }
            public string RedirectUri { get; set; }
            public string UserId { get; set; }

            public override void ExecuteResult(ControllerContext context)
            {
                var properties = new AuthenticationProperties { RedirectUri = RedirectUri };
                if (UserId != null)
                {
                    properties.Dictionary[XsrfKey] = UserId;
                }
                context.HttpContext.GetOwinContext().Authentication.Challenge(properties, LoginProvider);
            }
        }
        #endregion


        #region depricated

        //[AllowAnonymous]
        //public ActionResult TrialRegister()
        //{
        //    //return View();
        //    return RedirectToAction("Register");
        //}


        ////
        //// POST: /Account/Register
        //[HttpPost]
        //[AllowAnonymous]
        ////[ValidateAntiForgeryToken]
        //public async Task<ActionResult> TrialRegister(RegisterViewModel model)
        //{
        //    model.EmailDisplay = model.EmailAddress;

        //    if (!ModelState.IsValid) return View("Register");

        //    //if (!ModelState.IsValid) return View("TrialRegister");

        //    var user = new ApplicationUser
        //    {
        //        UserName = model.EmailAddress,
        //        Email = model.EmailAddress,
        //        FirstName = model.FirstName,
        //        LastName = model.LastName,
        //        ScreenName = model.ScreenName,
        //        //Subscribed = true,
        //        //SubscriptionId = 999999
        //    };


        //    var result = await UserManager.CreateAsync(user, model.PasswordValue);
        //    if (result.Succeeded)
        //    {
        //        await SignInManager.SignInAsync(user, isPersistent: false, rememberBrowser: false);

        //        // For more information on how to enable account confirmation and password reset please visit http://go.microsoft.com/fwlink/?LinkID=320771
        //        // Send an email with this link
        //        string code = await UserManager.GenerateEmailConfirmationTokenAsync(user.Id);
        //        var callbackUrl = Url.Action("ConfirmEmail", "Account", new { userId = user.Id, code = code }, protocol: Request.Url.Scheme);
        //        await UserManager.SendEmailAsync(user.Id, "Confirm your account", "Please confirm your account by clicking <a href=\"" + callbackUrl + "\">here</a>");

        //        return RedirectToAction("Index", "Home");
        //    }
        //    AddErrors(result);

        //    // If we got this far, something failed, redisplay form
        //    //ViewBag.Error = ModelState.Values.SelectMany(m => m.Errors); 
        //    return View("TrialRegister");
        //}

        //// GET: /Account/QrCodeLogin
        //[AllowAnonymous]
        //public ActionResult QrCodeLogin()
        //{
        //    var code = BlackboxTraderApi.GetQrCode();

        //    dynamic deserializedCode = JsonConvert.DeserializeObject(code);

        //    string url = deserializedCode.result.QRCodeURL;
        //    string token = deserializedCode.result.RandomToken;


        //    ViewBag.QrCodeUrl = url;
        //    ViewBag.RandomToken = token;
        //    return View();
        //}

        //[AllowAnonymous]
        //public ActionResult QrCodeAuthenticate(string token)
        //{

        //    var codeStatus = BlackboxTraderApi.CheckQrCodeStatus(token); // returns a status or ID
        //    //codeStatus = "linqq_590236640ae88";
        //    if (codeStatus == "0" || codeStatus == "1")
        //    {
        //        return RedirectToAction("QrCodeLogin", "Account");
        //    }

        //    // Login
        //    var user = UserManager.FindByName(codeStatus);

        //    if (user != null)
        //    {
        //        SignInManager.SignIn(user, false, false);
        //        return RedirectToAction("Index", "BlackBox", new { token = token });
        //    }

        //    //TODO:  Call API to get profile information and use for creating user
        //    var newuser = new ApplicationUser
        //    {
        //        UserName = codeStatus,
        //        Email = codeStatus + "@linqq.co" // Profile requires an email...
        //    };

        //    var result = UserManager.Create(newuser);
        //    if (result.Succeeded)
        //    {
        //        SignInManager.SignIn(UserManager.FindByName(codeStatus), false, false);
        //        return RedirectToAction("Index", "BlackBox", new {token = token});
        //    }

        //    return RedirectToAction("Error", "Account");

        //}



        //[AllowAnonymous]
        //[HttpPost]
        //public ActionResult CheckQrCodeLoginStatus(string token)
        //{
        //    return Content(BlackboxTraderApi.CheckQrCodeStatus(token));
        //}

        //public ActionResult Disabled()
        //{
        //    return View();
        //}
        //public ActionResult ChinaUserInfo()
        //{
        //    return View();
        //}



        #endregion

    }
}