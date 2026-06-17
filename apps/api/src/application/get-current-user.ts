import type { UserRepository } from "../domain/user-repository.js";
import type { UserId } from "../domain/user.js";

export type GetCurrentUserInput = Readonly<{
  userId: UserId;
}>;

export type GetCurrentUserUserDto = Readonly<{
  id: string;
  email: string;
}>;

export type GetCurrentUserSuccess = Readonly<{
  user: GetCurrentUserUserDto;
}>;

export type GetCurrentUserError = Readonly<{
  type: "user-not-found";
}>;

export type GetCurrentUserResult =
  | { success: true; data: GetCurrentUserSuccess }
  | { success: false; error: GetCurrentUserError };

export type GetCurrentUserDependencies = Readonly<{
  userRepository: UserRepository;
}>;

export async function getCurrentUser(
  input: GetCurrentUserInput,
  deps: GetCurrentUserDependencies,
): Promise<GetCurrentUserResult> {
  const user = await deps.userRepository.findById(input.userId);
  if (user === null) {
    return {
      success: false,
      error: {
        type: "user-not-found",
      },
    };
  }

  return {
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
      },
    },
  };
}
