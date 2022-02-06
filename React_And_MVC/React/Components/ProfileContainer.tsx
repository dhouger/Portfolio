//@ts-ignore
import { MatrixClient, MatrixEvent } from "matrix-js-sdk";
import { setBlockedUsers, setProfileData } from "actions";
import * as React from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import Description from "./Description";
import ProfileName from "./Name";

import "./styles.scss";
import UserLists from "./UserLists";
import List from "./List";

interface IProfileContainerProps {
  client: MatrixClient;
  setProfileData: () => void;
  replyTo: (event: MatrixEvent) => void;
  showReceipts: (mxEvent: MatrixEvent) => void;
  typingText: string;
  canWrite: boolean; // If client can send messages
  isGuest: boolean; // If client is in guest mode
  setBlockedUsers: (userIds: string[]) => void;
}

class ProfileContainer extends React.Component<IProfileContainerProps> {
  componentDidMount() {
    this.props.setProfileData();
    const ignoredUsers = this.props.client.getIgnoredUsers();
    this.props.setBlockedUsers(ignoredUsers);
  }

  render() {
    return (
      <div style={{ width: "99%" }}>
        <ProfileName client={this.props.client} />
        <Description />
        <UserLists />
        <List
          client={this.props.client}
          replyTo={this.props.replyTo}
          canWrite={true}
          isGuest={false}
          showReceipts={this.props.showReceipts}
          typingText={this.props.typingText}
        />
      </div>
    );
  }
}

const mapAppStateToProps = () => {
  return {};
};

const mapDispatchToProps = (dispatch: any) => {
  return bindActionCreators(
    {
      setProfileData: setProfileData,
      setBlockedUsers: setBlockedUsers,
    },
    dispatch
  );
};

export default connect(
  mapAppStateToProps,
  mapDispatchToProps
)(ProfileContainer);
