import {
  SET_PROFILE_LOADING,
  FOLLOW_USER,
  UNFOLLOW_USER,
  SUBSCRIBE_TO_USER,
  UNSUBSCRIBE_TO_USER,
  SET_IS_POPOVER_OPEN,
  SET_ROLE,
  SET_MENTIONS,
  SET_PROFILE_DATA,
  SET_EXPAND_PROFILE,
  SET_BLOCKED_USERS,
  CHANGE_PROFILE_VIEW,
  SET_AVATAR_URL,
} from "actions/types";
import { ISocialNetwork } from "Components/ProfileContainer/SocialNetworks";

interface IFollow {
  UserId: string;
  ScreenName: string;
  MutualConnection: boolean;
}

interface IProfile {
  BlockedUsers: string[];
  Description: string;
  Email: string;
  FirstName: string;
  Followers: IFollow[];
  Following: IFollow[];
  Id: string;
  LastName: string;
  Mentions: string[];
  PhoneNumber: string;
  ProfileImageFileName: string;
  ScreenName: string;
  SocialNetworks: ISocialNetwork[];
  SubscribedChannels: string[];
}

const profileReducer = (
  state: any = {
    mentions: [],
    isFollowUnfollowOpen: false,
    roleId: "",
    screenName: "",
    profileDescription: "",
    expandProfile: false,
    profileView: "default",
    profile: {},
    blockedUsers: [],
    avatarUrl: "",
    profileLoading: false,
  },
  action: any
) => {
  switch (action.type) {
    case SET_PROFILE_LOADING:
      return {
        ...state,
        profileLoading: action.payload.profileLoading,
      };
    case FOLLOW_USER:
      var updatedProfile = state.profile;
      updatedProfile.Following = action.payload.followers;

      //NOTE: Update mutual connections for the follower being added
      updatedProfile.Followers = updatedProfile.Followers?.map(
        (follow: IFollow) => {
          if (follow.ScreenName === action.payload.screenName) {
            follow.MutualConnection = true;
          }

          return follow;
        }
      );

      return {
        ...state,
        profile: updatedProfile,
        profileLoading: false,
      };
    case UNFOLLOW_USER:
      var updatedProfile = state.profile;
      updatedProfile.Following = action.payload.followers;

      //NOTE: Update mutual connections for the follower being removed
      updatedProfile.Followers = updatedProfile.Followers?.map(
        (follow: IFollow) => {
          if (follow.ScreenName === action.payload.screenName) {
            follow.MutualConnection = false;
          }

          return follow;
        }
      );
      return {
        ...state,
        followUsers: action.payload.followers,
        profile: updatedProfile,
        profileLoading: false,
      };
    case SUBSCRIBE_TO_USER:
      var updatedProfile = state.profile;
      updatedProfile.SubscribedChannels = action.payload.subscribedChannels;
      return {
        ...state,
        profile: updatedProfile,
        profileLoading: false,
      };
    case UNSUBSCRIBE_TO_USER:
      var updatedProfile = state.profile;
      updatedProfile.SubscribedChannels = action.payload.subscribedChannels;
      return {
        ...state,
        subscribedChannels: action.payload.subscribedChannels,
        profile: updatedProfile,
        profileLoading: false,
      };
    case SET_IS_POPOVER_OPEN:
      return {
        ...state,
        isFollowUnfollowOpen: action.payload.isFollowUnfollowOpen,
      };
    case SET_ROLE:
      return {
        ...state,
        roleId: action.payload.roleId,
      };
    case SET_MENTIONS: {
      return {
        ...state,
        mentions: action.payload.mentions,
      };
    }
    case SET_PROFILE_DATA: {
      return {
        ...state,
        profileDescription: action.payload.profileDescription,
        firstName: action.payload.firstName,
        lastName: action.payload.lastName,
        socialNetworks: action.payload.socialNetworks,
        profile: action.payload.profile,
      };
    }
    case SET_EXPAND_PROFILE: {
      return {
        ...state,
        expandProfile: action.payload.expandProfile,
      };
    }
    case SET_BLOCKED_USERS: {
      return {
        ...state,
        blockedUsers: action.payload.blockedUsers,
      };
    }
    case CHANGE_PROFILE_VIEW: {
      return {
        ...state,
        profileView: action.payload.profileView,
      };
    }
    case SET_AVATAR_URL: {
      return {
        ...state,
        avatarUrl: action.payload.avatarUrl,
      };
    }
    default:
      return state;
  }
};

export { IFollow, IProfile };

export default profileReducer;
